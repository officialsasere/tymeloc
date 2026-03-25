package com.tymeloc

// AlarmManager lets you schedule code to run at an exact time,
// even when the app is closed or the phone is in deep sleep.
// 📖 https://developer.android.com/reference/android/app/AlarmManager

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*

class SchedulerModule(private val reactContext: ReactApplicationContext)
  : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "SchedulerModule"

  companion object {
    const val TAG = "Tymeloc"
  }

  // Called from JS whenever a schedule is saved or toggled on.
  // triggerAtMs = exact millisecond timestamp when the lock should start.
  // unlockAtMs  = exact millisecond timestamp when the lock should end.
  // scheduleId  = unique string id so we can cancel this specific alarm later.
  @ReactMethod
  fun setScheduleAlarm(scheduleId: String, triggerAtMs: Double, unlockAtMs: Double) {
    val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    // The Intent that fires when the alarm triggers.
    // ScheduleReceiver will handle it and start LockService.
    val intent = Intent(reactContext, ScheduleReceiver::class.java).apply {
      putExtra("scheduleId", scheduleId)
      putExtra("unlockAtMs", unlockAtMs.toLong())
    }

    // PendingIntent.getBroadcast wraps our intent so AlarmManager can fire it
    // even when our app is not running.
    // requestCode uses scheduleId.hashCode() so each schedule gets its own slot.
    val pending = PendingIntent.getBroadcast(
      reactContext,
      scheduleId.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // setExactAndAllowWhileIdle fires even in Doze mode (battery saver).
    // This is the only alarm type that's reliable for exact times.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      am.setExactAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        triggerAtMs.toLong(),
        pending
      )
    } else {
      am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs.toLong(), pending)
    }

    Log.d(TAG, "Alarm set for scheduleId=$scheduleId at $triggerAtMs")
  }

  // Called when user disables or deletes a schedule.
  @ReactMethod
  fun cancelScheduleAlarm(scheduleId: String) {
    val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    val intent = Intent(reactContext, ScheduleReceiver::class.java)
    val pending = PendingIntent.getBroadcast(
      reactContext,
      scheduleId.hashCode(),
      intent,
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
    )

    pending?.let {
      am.cancel(it)
      Log.d(TAG, "Alarm cancelled for scheduleId=$scheduleId")
    }
  }

  // Check if the app has permission to schedule exact alarms (Android 12+).
  // Without this, setExactAndAllowWhileIdle silently fails on API 31+.
  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val am = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      promise.resolve(am.canScheduleExactAlarms())
    } else {
      promise.resolve(true) // always allowed below Android 12
    }
  }

  // Opens the exact alarm permission settings screen (Android 12+ only).
  @ReactMethod
  fun openExactAlarmSettings() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val intent = Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      reactContext.startActivity(intent)
    }
  }
}