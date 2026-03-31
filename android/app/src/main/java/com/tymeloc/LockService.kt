package com.tymeloc




import android.app.*
// import android.media.RingtoneManager
import android.media.AudioAttributes
// import android.media.MediaPlayer
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
import android.media.AudioTrack
import android.media.AudioFormat
import android.media.AudioManager
import org.json.JSONArray

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
  private var appEnforcementRunnable: Runnable? = null




  private fun startAppEnforcement() {
  appEnforcementRunnable = object : Runnable {
    override fun run() {
      try {
        val prefs = getSharedPreferences("tymeloc", Context.MODE_PRIVATE)
        val lockedAppsJson = prefs.getString("lockedApps", "[]") ?: "[]"
        val lockedApps = JSONArray(lockedAppsJson)
        val now = System.currentTimeMillis()

        // Get foreground app using UsageStatsManager
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as android.app.usage.UsageStatsManager
        val stats = usm.queryUsageStats(
          android.app.usage.UsageStatsManager.INTERVAL_DAILY,
          now - 5000, now
        )
        val foreground = stats
          ?.filter { it.lastTimeUsed > 0 }
          ?.maxByOrNull { it.lastTimeUsed }
          ?.packageName

        if (foreground != null) {
          var shouldShow = false
          var lockUntil = 0L

          for (i in 0 until lockedApps.length()) {
            val app = lockedApps.getJSONObject(i)
            val pkg = app.getString("packageName")
            val until = app.getLong("lockUntil")

            if (pkg == foreground && until > now) {
              shouldShow = true
              lockUntil = until
              break
            }
          }

          if (shouldShow && overlayView == null) {
            Log.d(TAG, "Locked app detected in foreground: $foreground")
            showOverlay(lockUntil)
          } else if (!shouldShow && overlayView != null && unlockTimeMs == 0L) {
            // Only remove if this is an app-lock overlay (not phone lock)
            removeOverlay()
          }
        }
      } catch (e: Exception) {
        Log.e(TAG, "App enforcement error: ${e.message}")
      }
      handler.postDelayed(this, 1000)
    }
  }
  handler.post(appEnforcementRunnable!!)
}

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

    startAppEnforcement()

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
       WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
    PixelFormat.OPAQUE
)

      val root = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(Color.parseColor("#07070f"))
        setPadding(80, 0, 80, 0)
      }

      root.addView(TextView(this).apply {
        text = "DEVICE LOCKDOWN"
        setTextColor(Color.parseColor("#64648e"))
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
        setTextColor(Color.parseColor("#64648e"))
        textSize = 14f
        typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
        gravity = Gravity.CENTER
      })

      root.addView(spacer(120))

      root.addView(TextView(this).apply {
        text = "stay focused."
        setTextColor(Color.parseColor("#535370"))
        textSize = 13f
        letterSpacing = 0.08f
        gravity = Gravity.CENTER
      })

      wm.addView(root, params)
      overlayView = root
      playLockSound() 
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
        playUnlockSound()
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
    appEnforcementRunnable?.let { handler.removeCallbacks(it) }
appEnforcementRunnable = null
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


private fun guitarSample(
    i: Int,
    sampleRate: Int,
    freq: Double,
    durationSamples: Int
): Double {
    val t = i.toDouble() / sampleRate

    // Harmonics for a guitar-like tone
    val fundamental = Math.sin(2 * Math.PI * freq * t)
    val harmonic2   = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t)
    val harmonic3   = 0.3 * Math.sin(2 * Math.PI * freq * 3 * t)

    // Optional subtle detune / imperfection
    val detune = freq * (1 + (Math.random() - 0.5) * 0.01)
    val detunedFundamental = Math.sin(2 * Math.PI * detune * t)

    // Pluck envelope: fast attack + exponential decay
    val attack = Math.min(1.0, i / (sampleRate * 0.01)) // 10ms attack
    val decay  = Math.exp(-3.0 * i / durationSamples)   // natural fade

    // Slight noise to simulate string imperfection
    val noise = (Math.random() - 0.5) * 0.02

    return (detunedFundamental + harmonic2 + harmonic3) * attack * decay + noise
}


private fun playLockSound() {
    Thread {
        try {
            val sampleRate = 44100
            val beepHz = 440        // A4, muted guitar pluck
            val beepMs = 120
            val gapMs = 80

            val beepSamples = sampleRate * beepMs / 1000
            val gapSamples = sampleRate * gapMs / 1000
            val totalSamples = beepSamples * 2 + gapSamples
            val buffer = ShortArray(totalSamples)

            // First pluck
            for (i in 0 until beepSamples) {
                buffer[i] = (guitarSample(i, sampleRate, beepHz.toDouble(), beepSamples) * 32767).toInt().toShort()
            }

            // Second pluck
            for (i in 0 until beepSamples) {
                val idx = beepSamples + gapSamples + i
                buffer[idx] = (guitarSample(i, sampleRate, beepHz.toDouble(), beepSamples) * 32767).toInt().toShort()
            }

            val track = AudioTrack(
                AudioManager.STREAM_NOTIFICATION,
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                buffer.size * 2,
                AudioTrack.MODE_STATIC
            )
            track.write(buffer, 0, buffer.size)
            track.play()
            Thread.sleep((beepMs * 2 + gapMs + 50).toLong())
            track.stop()
            track.release()
        } catch (e: Exception) {
            Log.e(TAG, "Lock sound failed: ${e.message}")
        }
    }.start()
}

private fun playUnlockSound() {
    Thread {
        try {
            val sampleRate = 44100
            val noteMs = 150
            val fadeMs = 30
            val notes = listOf(261.63, 329.63, 392.00) // C4, E4, G4

            val noteSamples = sampleRate * noteMs / 1000
            val totalSamples = noteSamples * notes.size
            val buffer = ShortArray(totalSamples)

            // Strum: small offset between notes
            val strumOffsetSamples = 50
             

            notes.forEachIndexed { noteIndex, hz ->
                val offset = noteIndex * noteSamples - noteIndex * strumOffsetSamples
                for (i in 0 until noteSamples) {
                    val idx = offset + i
                    if (idx < 0 || idx >= totalSamples) continue

                    // Fade in/out
                    val fadeInSamples = sampleRate * 10 / 1000
                    val fadeOutStart = noteSamples - fadeMs * sampleRate / 1000
                    val envelope = when {
                        i < fadeInSamples -> i.toDouble() / fadeInSamples
                        i > fadeOutStart  -> (noteSamples - i).toDouble() / (fadeMs * sampleRate / 1000)
                        else              -> 1.0
                    }

                    val sample = guitarSample(i, sampleRate, hz.toDouble(), noteSamples)
                    buffer[idx] = (sample * 32767 * 0.7 * envelope).toInt().toShort()
                }
            }

            val track = AudioTrack(
                AudioManager.STREAM_NOTIFICATION,
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                buffer.size * 2,
                AudioTrack.MODE_STATIC
            )
            track.write(buffer, 0, buffer.size)
            track.play()
            Thread.sleep((noteMs * notes.size + 100).toLong())
            track.stop()
            track.release()
        } catch (e: Exception) {
            Log.e(TAG, "Unlock sound failed: ${e.message}")
        }
    }.start()
}

  override fun onDestroy() {
    Log.d(TAG, "onDestroy")
    isRunning = false 
    cleanup()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}