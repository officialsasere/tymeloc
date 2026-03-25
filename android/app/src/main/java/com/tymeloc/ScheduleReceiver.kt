package com.tymeloc

// BroadcastReceiver that fires when the AlarmManager alarm triggers.
// Its job: check if the schedule is still valid, then start LockService.
// 📖 https://developer.android.com/guide/components/broadcasts

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class ScheduleReceiver : BroadcastReceiver() {

  companion object {
    const val TAG = "Tymeloc"
  }

  override fun onReceive(context: Context, intent: Intent) {
    val scheduleId = intent.getStringExtra("scheduleId") ?: return
    val unlockAtMs = intent.getLongExtra("unlockAtMs", 0L)

    Log.d(TAG, "ScheduleReceiver fired for scheduleId=$scheduleId unlockAt=$unlockAtMs")

    val now = System.currentTimeMillis()

    // Smart check: only lock if unlock time is still in the future.
    // If phone was off and the schedule already ended, skip it.
    if (unlockAtMs <= now) {
      Log.d(TAG, "Schedule $scheduleId already expired — skipping lock")
      return
    }

    // Save to SharedPreferences so BootReceiver can restore it on next reboot
    val prefs = context.getSharedPreferences("tymeloc", Context.MODE_PRIVATE)
    prefs.edit().putLong("phoneLockUntil", unlockAtMs).apply()

    // Start LockService — it will show the overlay and count down
    val serviceIntent = Intent(context, LockService::class.java).apply {
      putExtra("unlockTimeMs", unlockAtMs)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent)
    } else {
      context.startService(serviceIntent)
    }

    Log.d(TAG, "LockService started from schedule $scheduleId")
  }
}