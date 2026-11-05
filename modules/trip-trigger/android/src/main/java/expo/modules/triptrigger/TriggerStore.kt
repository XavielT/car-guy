package expo.modules.triptrigger

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * What the native half remembers between process lives: whether Automatico wants the trigger, the last "in vehicle" enter /
 * exit, a small event log the JS journal imports (so the journal can say why a trip did or did not start), and the
 * recorded sessions. No positions are ever written to the event log.
 */
object TriggerStore {
  private const val PREFS = "trip_trigger"
  private const val MAX_EVENTS = 120

  private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun isArmed(ctx: Context) = prefs(ctx).getBoolean("armed", false)
  fun setArmed(ctx: Context, v: Boolean) = prefs(ctx).edit().putBoolean("armed", v).apply()

  fun enterAt(ctx: Context) = prefs(ctx).getLong("enterAt", 0L)
  fun exitAt(ctx: Context) = prefs(ctx).getLong("exitAt", 0L)
  fun setEnter(ctx: Context, t: Long) = prefs(ctx).edit().putLong("enterAt", t).putLong("exitAt", 0L).apply()
  fun setExit(ctx: Context, t: Long) = prefs(ctx).edit().putLong("exitAt", t).apply()

  /** The app's own location service records until this instant: the native recorder must not run meanwhile. */
  fun jsHeldUntil(ctx: Context) = prefs(ctx).getLong("jsUntil", 0L)
  fun holdForJs(ctx: Context, until: Long) = prefs(ctx).edit().putLong("jsUntil", until).apply()
  fun jsHeld(ctx: Context) = System.currentTimeMillis() < jsHeldUntil(ctx)

  @Synchronized
  fun log(ctx: Context, event: String, detail: String = "") {
    try {
      val p = prefs(ctx)
      val list = JSONArray(p.getString("events", "[]"))
      val next = JSONArray()
      val from = maxOf(0, list.length() - (MAX_EVENTS - 1))
      for (i in from until list.length()) next.put(list.get(i))
      next.put(JSONObject().put("t", System.currentTimeMillis()).put("e", event).put("d", detail.take(160)))
      p.edit().putString("events", next.toString()).apply()
    } catch (_: Throwable) {
    }
  }

  fun events(ctx: Context): String = prefs(ctx).getString("events", "[]") ?: "[]"
  fun clearEvents(ctx: Context) = prefs(ctx).edit().putString("events", "[]").apply()

  fun dir(ctx: Context): File = File(ctx.applicationContext.filesDir, "trip-trigger").also { it.mkdirs() }
}
