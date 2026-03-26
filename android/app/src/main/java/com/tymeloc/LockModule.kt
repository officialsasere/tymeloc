package com.tymeloc

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*

class LockModule(private val reactContext: ReactApplicationContext)
  : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "LockModule"

  @ReactMethod
  fun hasOverlayPermission(promise: Promise) {
    promise.resolve(Settings.canDrawOverlays(reactContext))
  }

    @ReactMethod
  fun hasAccessibilityPermission(promise: Promise) {
    val context = reactApplicationContext
    val expectedService = "${context.packageName}/${LockAccessibilityService::class.java.canonicalName}"
    val enabledServices = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    )
    val enabled = enabledServices?.contains(expectedService) == true
    promise.resolve(enabled)
  }

  @ReactMethod
  fun requestAccessibilityPermission() {
    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    reactApplicationContext.startActivity(intent)
  }


  @ReactMethod
  fun requestOverlayPermission() {
    val intent = Intent(
      Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
      Uri.parse("package:${reactContext.packageName}")
    ).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK }
    reactContext.startActivity(intent)
  }
  
  

  @ReactMethod
  fun startLockService(unlockTimeMs: Double) {
    val prefs = reactContext.getSharedPreferences("tymeloc", Context.MODE_PRIVATE)
    prefs.edit().putLong("phoneLockUntil", unlockTimeMs.toLong()).apply()

    val intent = Intent(reactContext, LockService::class.java).apply {
      putExtra("unlockTimeMs", unlockTimeMs.toLong())
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactContext.startForegroundService(intent)
    } else {
      reactContext.startService(intent)
    }
  }

  @ReactMethod
fun mirrorSchedules(schedulesJson: String) {
  val prefs = reactContext.getSharedPreferences("tymeloc", Context.MODE_PRIVATE)
  prefs.edit().putString("schedules_mirror", schedulesJson).apply()
}

  @ReactMethod
  fun stopLockService() {
    val prefs = reactContext.getSharedPreferences("tymeloc", Context.MODE_PRIVATE)
    prefs.edit().putLong("phoneLockUntil", 0L).apply()
    reactContext.stopService(Intent(reactContext, LockService::class.java))
  }
}