package com.tymeloc


import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build


class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

 
 val prefs = context.getSharedPreferences("tymeloc", Context.MODE_PRIVATE)
    val unlockTimeMs = prefs.getLong("phoneLockUntil", 0L)

    // Only restart if the lock hasn't expired yet
    if (unlockTimeMs > System.currentTimeMillis()) {
      val serviceIntent = Intent(context, LockService::class.java).apply {
        putExtra("unlockTimeMs", unlockTimeMs)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
      } else {
        context.startService(serviceIntent)
      }
    }
  }
}