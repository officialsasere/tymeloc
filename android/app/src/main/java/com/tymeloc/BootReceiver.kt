package com.tymeloc

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray
import java.util.Calendar


class BootReceiver : BroadcastReceiver() {

  
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

 
 val prefs = context.getSharedPreferences("tymeloc", Context.MODE_PRIVATE)

   val now = System.currentTimeMillis()
    val unlockTimeMs = prefs.getLong("phoneLockUntil", 0L)

    // Only restart if the lock hasn't expired yet
    if (unlockTimeMs > now) {
      val serviceIntent = Intent(context, LockService::class.java).apply {
        putExtra("unlockTimeMs", unlockTimeMs)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
      } else {
        context.startService(serviceIntent)
      }
       return 
    }
    // ── NEW: check schedules if no manual lock is active ─────────────
    // JS mirrors schedules here whenever app opens or schedules change
    val schedulesJson = prefs.getString("schedules_mirror", "[]") ?: "[]"

    try {
      val schedules = JSONArray(schedulesJson)

      for (i in 0 until schedules.length()) {
        val s = schedules.getJSONObject(i)
        if (!s.getBoolean("enabled")) continue

        val lockHour     = s.getInt("lockHour")
        val lockMinute   = s.getInt("lockMinute")
        val unlockHour   = s.getInt("unlockHour")
        val unlockMinute = s.getInt("unlockMinute")
        val repeatType   = s.getString("repeatType")
        val id           = s.getString("id")

        // Build today's lock and unlock timestamps
        val lockCal = Calendar.getInstance().apply {
          set(Calendar.HOUR_OF_DAY, lockHour)
          set(Calendar.MINUTE, lockMinute)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
        }
        val unlockCal = Calendar.getInstance().apply {
          set(Calendar.HOUR_OF_DAY, unlockHour)
          set(Calendar.MINUTE, unlockMinute)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
        }

        // Overnight schedule e.g. 22:00 – 06:00
        if (unlockCal.timeInMillis <= lockCal.timeInMillis) {
          unlockCal.add(Calendar.DAY_OF_MONTH, 1)
        }

        val lockMs   = lockCal.timeInMillis
        val unlockMs = unlockCal.timeInMillis

        // Does this schedule apply today?
        val appliesToday = when (repeatType) {
          "daily" -> true
          "days"  -> {
            val daysArray = s.getJSONArray("days")
            val todayDow  = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1
            (0 until daysArray.length()).any { daysArray.getInt(it) == todayDow }
          }
          "range" -> {
            val startDate = s.getString("startDate")
            val endDate   = s.getString("endDate")
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
            val todayStr = sdf.format(java.util.Date(now))
            todayStr >= startDate && todayStr <= endDate
          }
          else -> false
        }

        if (!appliesToday) continue

        when {
          // Booted inside the lock window — lock immediately
          now in lockMs..unlockMs -> {
            Log.d("Tymeloc", "Boot inside schedule window — locking now")
            val serviceIntent = Intent(context, LockService::class.java).apply {
              putExtra("unlockTimeMs", unlockMs)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              context.startForegroundService(serviceIntent)
            } else {
              context.startService(serviceIntent)
            }
            return // one lock at a time
          }

          // Lock window not started yet — set the alarm
          now < lockMs -> {
            Log.d("Tymeloc", "Setting schedule alarm for $id at $lockMs")
            val alarmIntent = Intent(context, ScheduleReceiver::class.java).apply {
              putExtra("scheduleId", id)
              putExtra("unlockAtMs", unlockMs)
            }
            val pending = PendingIntent.getBroadcast(
              context,
              id.hashCode(),
              alarmIntent,
              PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
              am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, lockMs, pending)
            } else {
              am.setExact(AlarmManager.RTC_WAKEUP, lockMs, pending)
            }
          }

          // Window already passed today — skip, JS will set tomorrow's alarm
          else -> Log.d("Tymeloc", "Schedule $id window already passed — skipping")
        }
      }
    } catch (e: Exception) {
      Log.e("Tymeloc", "Error reading schedules on boot: ${e.message}")
    }
  }
}