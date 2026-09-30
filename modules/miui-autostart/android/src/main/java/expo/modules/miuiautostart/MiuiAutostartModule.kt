package expo.modules.miuiautostart

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * MIUI / HyperOS "Inicio automático" (Car Guy 2.2.2): the state Automático needs
 * to keep recording, read the way XomaDev/MIUI-autostart does — MIUI's hidden
 * android.miui.AppOpsUtils.getApplicationAutoStart(context, package), by
 * reflection. 0 = allowed, 1 = denied, anything else (or no such class on a
 * non-Xiaomi phone) = unknown.
 */
class MiuiAutostartModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MiuiAutostart")

    Function("getState") {
      val ctx = appContext.reactContext ?: return@Function "unknown"
      try {
        val cls = Class.forName("android.miui.AppOpsUtils")
        val method = cls.getDeclaredMethod("getApplicationAutoStart", Context::class.java, String::class.java)
        method.isAccessible = true
        when (method.invoke(null, ctx, ctx.packageName) as? Int) {
          0 -> "enabled"
          1 -> "disabled"
          else -> "unknown"
        }
      } catch (e: Throwable) {
        "unknown"
      }
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
