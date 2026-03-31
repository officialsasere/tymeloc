package com.tymeloc

// PackageManager gives us the list of every app installed on the device.
// 📖 https://developer.android.com/reference/android/content/pm/PackageManager

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

class InstalledAppsModule(private val reactContext: ReactApplicationContext)
  : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "InstalledAppsModule"

  @ReactMethod
  fun getInstalledApps(promise: Promise) {
    Thread {
      try {
        val pm = reactContext.packageManager

        // GET_META_DATA gives us the full app info including icon
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
          .filter { app ->
            // Only show user-installed apps — filter out system apps
            // EXCEPT apps that have a launcher icon (some system apps users can open)
            val isUserApp = app.flags and ApplicationInfo.FLAG_SYSTEM == 0
            val hasLauncher = pm.getLaunchIntentForPackage(app.packageName) != null
            val isNotUs = app.packageName != reactContext.packageName
            (isUserApp || hasLauncher) && isNotUs
          }
          .sortedBy { pm.getApplicationLabel(it).toString().lowercase() }

        val result = WritableNativeArray()

        for (app in apps) {
          try {
            val map = WritableNativeMap()
            map.putString("packageName", app.packageName)
            map.putString("appName", pm.getApplicationLabel(app).toString())

            // Convert icon to base64 so JS can display it as an image
            val icon = pm.getApplicationIcon(app.packageName)
            val bitmap = Bitmap.createBitmap(
              icon.intrinsicWidth.coerceAtLeast(1),
              icon.intrinsicHeight.coerceAtLeast(1),
              Bitmap.Config.ARGB_8888
            )
            val canvas = Canvas(bitmap)
            icon.setBounds(0, 0, canvas.width, canvas.height)
            icon.draw(canvas)

            val baos = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 80, baos)
            val iconBase64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
            map.putString("icon", "data:image/png;base64,$iconBase64")

            result.pushMap(map)
          } catch (e: Exception) {
            Log.e("Tymeloc", "Error processing app ${app.packageName}: ${e.message}")
          }
        }

        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("APP_LIST_ERROR", e.message)
      }
    }.start()
  }
}