package com.tymeloc

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

class LockService : Service() {

  companion object {
    const val CHANNEL_ID = "tymeloc_channel"
    const val NOTIF_ID   = 1
    const val TAG        = "Tymeloc"

    var isRunning = false
  }

  private var overlayView: View? = null
  private var countdownText: TextView? = null
  private val handler = Handler(Looper.getMainLooper())
  private var unlockTimeMs = 0L

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
       if (isRunning) {
        Log.d(TAG, "Service already running — ignoring duplicate start")
        return START_STICKY
    }

    isRunning = true

    unlockTimeMs = intent?.getLongExtra("unlockTimeMs", 0L) ?: 0L
    Log.d(TAG, "onStartCommand unlockTimeMs=$unlockTimeMs")

    // Create channel first
    createNotificationChannel()
    Log.d(TAG, "Notification channel created")

    // Call startForeground with NO type parameter
    // This is the version that works on all Android versions without extra permissions
    startForeground(NOTIF_ID, buildNotification(unlockTimeMs))
    Log.d(TAG, "startForeground called")

    // Show overlay
    showOverlay(unlockTimeMs)

    // Start countdown
    startCountdownChecker()

    return START_STICKY
  }

  // private fun startCountdownChecker() {
  //   handler.post(object : Runnable {
  //     override fun run() {
  //       if (System.currentTimeMillis() >= unlockTimeMs) {
  //         Log.d(TAG, "Lock expired")
  //         cleanup()
  //         stopSelf()
  //       } else {
  //         updateCountdown()
  //         handler.postDelayed(this, 1000)
  //       }
  //     }
  //   })
  // }


  private fun startCountdownChecker() {
    handler.post(object : Runnable {
      override fun run() {
        val remaining = maxOf(0L, unlockTimeMs - System.currentTimeMillis())
        Log.d(TAG, "Countdown: ${remaining / 1000}s remaining")
        if (remaining <= 0) {
          Log.d(TAG, "Lock expired")
          cleanup()
          stopSelf()
        } else {
          updateCountdown()
          handler.postDelayed(this, 1000)
        }
      }
    })
}

  private fun showOverlay(unlockMs: Long) {
    if (overlayView != null) return

    if (!Settings.canDrawOverlays(this)) {
      Log.e(TAG, "No overlay permission")
      return
    }

    try {
      val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager

     val params = WindowManager.LayoutParams(
    WindowManager.LayoutParams.MATCH_PARENT,
    WindowManager.LayoutParams.MATCH_PARENT,
    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
    PixelFormat.OPAQUE
)

      val root = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(Color.parseColor("#07070f"))
        setPadding(80, 0, 80, 0)
      }

      root.addView(TextView(this).apply {
        text = "LOCKDOWN"
        setTextColor(Color.parseColor("#2a2a4a"))
        textSize = 11f
        letterSpacing = 0.3f
        gravity = Gravity.CENTER
      })

      root.addView(spacer(56))

      countdownText = TextView(this).apply {
        text = formatCountdown(unlockMs)
        setTextColor(Color.parseColor("#e8e8ff"))
        textSize = 56f
        typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
        gravity = Gravity.CENTER
        letterSpacing = 0.04f
      }
      root.addView(countdownText)

      root.addView(spacer(28))

      val unlockTime = java.text.SimpleDateFormat(
        "hh:mm a", java.util.Locale.getDefault()
      ).format(java.util.Date(unlockMs))

      root.addView(TextView(this).apply {
        text = "unlocks at $unlockTime"
        setTextColor(Color.parseColor("#2a2a4a"))
        textSize = 14f
        typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
        gravity = Gravity.CENTER
      })

      root.addView(spacer(120))

      root.addView(TextView(this).apply {
        text = "stay focused."
        setTextColor(Color.parseColor("#18183a"))
        textSize = 13f
        letterSpacing = 0.08f
        gravity = Gravity.CENTER
      })

      wm.addView(root, params)
      overlayView = root
      Log.d(TAG, "Overlay added successfully")

    } catch (e: Exception) {
      Log.e(TAG, "Overlay failed: ${e.message}")
    }
  }

  private fun spacer(height: Int) = View(this).apply {
    layoutParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT, height
    )
  }

  private fun updateCountdown() {
    handler.post {
      countdownText?.text = formatCountdown(unlockTimeMs)
    }
  }

  private fun formatCountdown(ms: Long): String {
    val remaining = maxOf(0L, ms - System.currentTimeMillis())
    val h = remaining / 3600000
    val m = (remaining % 3600000) / 60000
    val s = (remaining % 60000) / 1000
    return "%02d:%02d:%02d".format(h, m, s)
  }

  private fun removeOverlay() {
    overlayView?.let {
      try {
        (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(it)
        Log.d(TAG, "Overlay removed")
      } catch (e: Exception) {
        Log.e(TAG, "Remove error: ${e.message}")
      }
      overlayView = null
      countdownText = null
    }
  }

  private fun cleanup() {
    handler.removeCallbacksAndMessages(null)
    removeOverlay()
    getSharedPreferences("tymeloc", Context.MODE_PRIVATE)
      .edit().putLong("phoneLockUntil", 0L).apply()
  }

  private fun buildNotification(unlockMs: Long): Notification {
    val unlockTime = java.text.SimpleDateFormat(
      "hh:mm a", java.util.Locale.getDefault()
    ).format(java.util.Date(unlockMs))

    return Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("Tymeloc active")
      .setContentText("Locked until $unlockTime")
      .setSmallIcon(android.R.drawable.ic_lock_lock)
      .setOngoing(true)
      .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Tymeloc",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        enableLights(false)
        enableVibration(false)
        setShowBadge(false)
      }
      getSystemService(NotificationManager::class.java)
        .createNotificationChannel(channel)
    }
  }

  override fun onDestroy() {
    Log.d(TAG, "onDestroy")
    isRunning = false 
    cleanup()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}