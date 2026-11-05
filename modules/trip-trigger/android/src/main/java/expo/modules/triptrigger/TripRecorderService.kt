package expo.modules.triptrigger

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter
import java.util.Locale

/**
 * Records the fixes of a drive while the JS app is closed (started by TransitionReceiver on "in a vehicle"). It only writes
 * raw fixes to a file; the JS trip machine decides what is a trip when the app next opens (same rules as always).
 * Stops two minutes after the "left the vehicle" event, after six minutes without moving, after eight hours, or when
 * Automatico is turned off.
 */
class TripRecorderService : Service() {
  companion object {
    @Volatile var running = false
    private const val CHANNEL = "carguy_trip_recorder"
    private const val NOTIF_ID = 7002
    private const val EXIT_GRACE_MS = 120_000L
    private const val STILL_MS = 6 * 60_000L
    private const val CAP_MS = 8 * 3_600_000L
  }

  private var callback: LocationCallback? = null
  private var writer: BufferedWriter? = null
  private var part: File? = null
  private var startedAt = 0L
  private var lastMoveAt = 0L
  private var lastLat = Double.NaN
  private var lastLng = Double.NaN
  private val handler = Handler(Looper.getMainLooper())
  private val ticker = object : Runnable {
    override fun run() {
      checkStop()
      if (running) handler.postDelayed(this, 30_000L)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (running) return START_STICKY
    try {
      val n = notification()
      if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION) else startForeground(NOTIF_ID, n)
    } catch (e: Throwable) {
      TriggerStore.log(this, "foreground-failed", "${e.javaClass.simpleName}: ${e.message}")
      stopSelf()
      return START_NOT_STICKY
    }
    startedAt = System.currentTimeMillis()
    lastMoveAt = startedAt
    try {
      part = File(TriggerStore.dir(this), "session-$startedAt.part")
      writer = BufferedWriter(FileWriter(part, true))
      val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L).setMinUpdateIntervalMillis(1000L).setMinUpdateDistanceMeters(0f).build()
      val cb = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) = write(result)
      }
      callback = cb
      LocationServices.getFusedLocationProviderClient(this).requestLocationUpdates(request, cb, Looper.getMainLooper())
      running = true
      TriggerStore.log(this, "recorder-start")
      handler.postDelayed(ticker, 30_000L)
    } catch (e: Throwable) {
      TriggerStore.log(this, "recorder-failed", "${e.javaClass.simpleName}: ${e.message}")
      finish("failed")
      return START_NOT_STICKY
    }
    return START_STICKY
  }

  private fun write(result: LocationResult) {
    val w = writer ?: return
    try {
      for (l in result.locations) {
        val sb = StringBuilder(96)
        sb.append("{\"t\":").append(l.time)
          .append(",\"la\":").append(String.format(Locale.US, "%.6f", l.latitude))
          .append(",\"lo\":").append(String.format(Locale.US, "%.6f", l.longitude))
          .append(",\"ac\":").append(if (l.hasAccuracy()) String.format(Locale.US, "%.1f", l.accuracy) else "null")
          .append(",\"sp\":").append(if (l.hasSpeed()) String.format(Locale.US, "%.2f", l.speed) else "null")
          .append(",\"br\":").append(if (l.hasBearing()) String.format(Locale.US, "%.0f", l.bearing) else "null")
          .append(",\"al\":").append(if (l.hasAltitude()) String.format(Locale.US, "%.0f", l.altitude) else "null")
          .append("}\n")
        w.write(sb.toString())
        val moved = (l.hasSpeed() && l.speed > 1.5f) ||
          (!lastLat.isNaN() && Math.abs(l.latitude - lastLat) + Math.abs(l.longitude - lastLng) > 0.00015)
        if (moved) {
          lastMoveAt = System.currentTimeMillis()
          lastLat = l.latitude
          lastLng = l.longitude
        } else if (lastLat.isNaN()) {
          lastLat = l.latitude
          lastLng = l.longitude
        }
      }
      w.flush()
    } catch (_: Throwable) {
    }
    checkStop()
  }

  private fun checkStop() {
    val now = System.currentTimeMillis()
    val exit = TriggerStore.exitAt(this)
    val reason = when {
      !TriggerStore.isArmed(this) -> "disarmed"
      TriggerStore.jsHeld(this) -> "app-took-over"
      exit > 0 && exit > TriggerStore.enterAt(this) && now - exit > EXIT_GRACE_MS -> "vehicle-exit"
      now - lastMoveAt > STILL_MS -> "still"
      now - startedAt > CAP_MS -> "cap"
      else -> null
    }
    if (reason != null) finish(reason)
  }

  private fun finish(reason: String) {
    if (!running && writer == null) {
      stopSelf()
      return
    }
    running = false
    handler.removeCallbacks(ticker)
    try {
      callback?.let { LocationServices.getFusedLocationProviderClient(this).removeLocationUpdates(it) }
    } catch (_: Throwable) {
    }
    callback = null
    try {
      writer?.close()
    } catch (_: Throwable) {
    }
    writer = null
    part?.let { p ->
      if (p.length() > 0) p.renameTo(File(p.parentFile, p.name.removeSuffix(".part") + ".jsonl")) else p.delete()
    }
    part = null
    TriggerStore.log(this, "recorder-stop", reason)
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    if (running) finish("destroyed")
    super.onDestroy()
  }

  private fun notification(): Notification {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val es = Locale.getDefault().language == "es"
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(NotificationChannel(CHANNEL, if (es) "Registro de viajes" else "Trip recording", NotificationManager.IMPORTANCE_LOW))
    }
    val icon = resources.getIdentifier("notification_icon", "drawable", packageName).takeIf { it != 0 } ?: android.R.drawable.ic_menu_mylocation
    @Suppress("DEPRECATION")
    val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    return b.setContentTitle("Car Guy")
      .setContentText(if (es) "Registrando tu viaje" else "Recording your trip")
      .setSmallIcon(icon)
      .setOngoing(true)
      .build()
  }
}
