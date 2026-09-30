package expo.modules.miuiautostart

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Process
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * MIUI / HyperOS "Inicio automático" (Car Guy 2.2.2): the state Automático needs
 * to keep recording, read the way XomaDev/MIUI-autostart does — MIUI's hidden
 * android.miui.AppOpsUtils.getApplicationAutoStart(context, package), by
 * reflection — and, where Android blocks that hidden class, MIUI's app-op 10008
 * through AppOpsManager. 0 = allowed, 1 = denied, anything else (or a
 * non-Xiaomi phone) = unknown.
 */
private const val TAG = "MiuiAutostart"
private const val OP_AUTO_START = 10008

class MiuiAutostartModule : Module() {
  private fun verdict(code: Int?): String? = when (code) {
    0 -> "enabled"
    1 -> "disabled"
    else -> null
  }

  /** MIUI's own helper (what XomaDev/MIUI-autostart calls). */
  private fun viaAppOpsUtils(ctx: Context): String? = try {
    val cls = Class.forName("android.miui.AppOpsUtils")
    val method = cls.getDeclaredMethod("getApplicationAutoStart", Context::class.java, String::class.java)
    method.isAccessible = true
    verdict(method.invoke(null, ctx, ctx.packageName) as? Int)
  } catch (e: Throwable) {
    Log.d(TAG, "AppOpsUtils: ${e.javaClass.simpleName}")
    null
  }

  /** MIUI's app-op 10008 (OP_AUTO_START) through AppOpsManager.checkOpNoThrow(int, int, String). */
  private fun viaAppOps(ctx: Context): String? = try {
    val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val method = AppOpsManager::class.java.getMethod("checkOpNoThrow", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType, String::class.java)
    val mode = method.invoke(ops, OP_AUTO_START, Process.myUid(), ctx.packageName) as Int
    Log.d(TAG, "op $OP_AUTO_START mode $mode")
    verdict(mode)
  } catch (e: Throwable) {
    Log.d(TAG, "AppOps: ${e.javaClass.simpleName}")
    null
  }

  override fun definition() = ModuleDefinition {
    Name("MiuiAutostart")

    Function("getState") {
      val ctx = appContext.reactContext ?: return@Function "unknown"
      viaAppOpsUtils(ctx) ?: viaAppOps(ctx) ?: "unknown"
    }

    /** MIUI's autostart list; else this app's system settings page. */
    Function("openSettings") {
      val ctx = appContext.reactContext ?: return@Function false
      val miui = Intent().apply {
        component = ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      try {
        ctx.startActivity(miui)
        true
      } catch (e: Throwable) {
        try {
          ctx.startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}"))
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          )
          true
        } catch (e2: Throwable) {
          false
        }
      }
    }
  }
}
