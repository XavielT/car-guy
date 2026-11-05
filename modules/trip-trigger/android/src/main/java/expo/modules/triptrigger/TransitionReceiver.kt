package expo.modules.triptrigger

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

const val ACTION_TRANSITION = "expo.modules.triptrigger.TRANSITION"

/** The PendingIntent Google Play services fires on "in a vehicle" enter / exit. Mutable: the system adds the result extras. */
fun transitionIntent(ctx: Context): PendingIntent {
  val intent = Intent(ctx, TransitionReceiver::class.java).setAction(ACTION_TRANSITION)
  val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
  return PendingIntent.getBroadcast(ctx.applicationContext, 7001, intent, flags)
}

fun transitionRequest(): ActivityTransitionRequest = ActivityTransitionRequest(
  listOf(
    ActivityTransition.Builder().setActivityType(DetectedActivity.IN_VEHICLE).setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER).build(),
    ActivityTransition.Builder().setActivityType(DetectedActivity.IN_VEHICLE).setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT).build(),
  ),
)

/** Registers the transitions with Play services; the callback says whether it worked. */
fun registerTransitions(ctx: Context, done: (String) -> Unit) {
  try {
    ActivityRecognition.getClient(ctx.applicationContext)
      .requestActivityTransitionUpdates(transitionRequest(), transitionIntent(ctx))
      .addOnSuccessListener { done("ok") }
      .addOnFailureListener { done("error: ${it.javaClass.simpleName}: ${it.message}") }
  } catch (e: Throwable) {
    done("error: ${e.javaClass.simpleName}: ${e.message}")
  }
}

class TransitionReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    if (intent.action != ACTION_TRANSITION || !ActivityTransitionResult.hasResult(intent)) return
    val result = ActivityTransitionResult.extractResult(intent) ?: return
    for (event in result.transitionEvents) {
      if (event.activityType != DetectedActivity.IN_VEHICLE) continue
      // The event's own time (the receiver can run late), as a wall-clock instant.
      val at = System.currentTimeMillis() - (SystemClock.elapsedRealtimeNanos() - event.elapsedRealTimeNanos) / 1_000_000
      if (event.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER) onEnter(ctx, at) else onExit(ctx, at)
    }
  }

  private fun onEnter(ctx: Context, at: Long) {
    TriggerStore.setEnter(ctx, at)
    TriggerStore.log(ctx, "vehicle-enter")
    if (!TriggerStore.isArmed(ctx)) {
      TriggerStore.log(ctx, "ignored", "not armed")
      return
    }
    if (TriggerStore.jsHeld(ctx)) {
      TriggerStore.log(ctx, "ignored", "app is recording")
      return
    }
    try {
      val svc = Intent(ctx, TripRecorderService::class.java)
      if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(svc) else ctx.startService(svc)
    } catch (e: Throwable) {
      // Android 12+ can refuse a foreground start from the background; the journal must say so, not stay silent.
      TriggerStore.log(ctx, "start-failed", "${e.javaClass.simpleName}: ${e.message}")
    }
  }

  private fun onExit(ctx: Context, at: Long) {
    TriggerStore.setExit(ctx, at)
    TriggerStore.log(ctx, "vehicle-exit")
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    if (!TriggerStore.isArmed(ctx)) return
    val what = intent.action?.substringAfterLast('.') ?: "boot"
    registerTransitions(ctx) { TriggerStore.log(ctx, "re-register:$what", it) }
  }
}
