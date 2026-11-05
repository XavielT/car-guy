package expo.modules.triptrigger

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.google.android.gms.location.ActivityRecognition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Automatic trips, the native half (IMP 03112026 PROMPT-09): Google Play services' Activity Recognition says "in a vehicle"
 * even with the app closed; TransitionReceiver starts TripRecorderService, which writes the fixes to a file; the JS app
 * drains the sessions when it opens and runs them through the same trip machine as always.
 */
class TripTriggerModule : Module() {
  private val ctx: Context get() = appContext.reactContext ?: throw IllegalStateException("no context")

  private fun hasActivity(c: Context) =
    Build.VERSION.SDK_INT < 29 || c.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED

  override fun definition() = ModuleDefinition {
    Name("TripTrigger")

    Function("hasActivityPermission") { hasActivity(ctx) }

    /** Registers the transitions. Resolves "ok", "no-permission" or "error: ...". */
    AsyncFunction("arm") { promise: Promise ->
      val c = ctx
      if (!hasActivity(c)) {
        promise.resolve("no-permission")
      } else {
        registerTransitions(c) { result ->
          if (result == "ok") TriggerStore.setArmed(c, true)
          TriggerStore.log(c, "arm", result)
          promise.resolve(result)
        }
      }
    }

    AsyncFunction("disarm") { promise: Promise ->
      val c = ctx
      TriggerStore.setArmed(c, false)
      TriggerStore.log(c, "disarm")
      try {
        ActivityRecognition.getClient(c).removeActivityTransitionUpdates(transitionIntent(c))
          .addOnCompleteListener { promise.resolve(true) }
      } catch (e: Throwable) {
        promise.resolve(false)
      }
    }

    /** The app's own service is recording until `untilMs` (epoch): the native recorder yields. */
    Function("holdForJs") { untilMs: Double -> TriggerStore.holdForJs(ctx, untilMs.toLong()) }

    Function("isArmed") { TriggerStore.isArmed(ctx) }
    Function("isRecording") { TripRecorderService.running }

    /** Stops the native recorder (the JS service takes over when the app is in front). Returns whether it was running. */
    Function("stopRecorder") {
      val was = TripRecorderService.running
      if (was) ctx.stopService(Intent(ctx, TripRecorderService::class.java))
      was
    }

    /** Finished sessions as {id, text}. A session the service left half-written (killed) counts once it is 10 minutes old. */
    Function("drainSessions") {
      val dir = TriggerStore.dir(ctx)
      val now = System.currentTimeMillis()
      dir.listFiles { f -> f.name.endsWith(".part") && now - f.lastModified() > 10 * 60_000L && !TripRecorderService.running }
        ?.forEach { it.renameTo(File(dir, it.name.removeSuffix(".part") + ".jsonl")) }
      (dir.listFiles { f -> f.name.endsWith(".jsonl") } ?: emptyArray()).sortedBy { it.name }.take(4).map { f ->
        mapOf("id" to f.name, "text" to f.readText())
      }
    }

    Function("ackSession") { id: String ->
      val f = File(TriggerStore.dir(ctx), File(id).name)
      f.name.endsWith(".jsonl") && f.delete()
    }

    Function("events") { TriggerStore.events(ctx) }
    Function("clearEvents") { TriggerStore.clearEvents(ctx) }

    /** The system's own record of why the process ended (Android 11+). JSON array, newest first. */
    Function("lastExitReasons") {
      val out = JSONArray()
      if (Build.VERSION.SDK_INT >= 30) {
        try {
          val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
          for (r in am.getHistoricalProcessExitReasons(ctx.packageName, 0, 12)) {
            out.put(JSONObject().put("t", r.timestamp).put("reason", r.reason).put("importance", r.importance).put("description", r.description ?: ""))
          }
        } catch (_: Throwable) {
        }
      }
      out.toString()
    }
  }
}
