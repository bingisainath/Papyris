package com.shareeven.app

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.ViewManager
import java.lang.ref.WeakReference

/**
 * Chat notifications in the phone's notification shade.
 *
 * Messages are end-to-end encrypted, so the server can't say what they say: the app decrypts each one
 * and shows it here (src/notifications/push.ts). Each chat has one notification (tag = conversation id,
 * id 0) that collects its newest messages, and goes away once the chat is read here or elsewhere.
 * Tapping it opens the app with the conversation id (MainActivity passes it on to the app).
 */
class NotificationsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "ShareEvenNotifications"

  init {
    current = WeakReference(this)
  }

  private val manager get() = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  /** A new message: { conversationId, sender, text, chat? (group name; none for a direct chat) }. */
  @ReactMethod
  fun showMessage(message: ReadableMap) {
    val context = reactApplicationContext
    val conversationId = message.getString("conversationId") ?: return
    val text = message.getString("text") ?: return
    val sender = message.getString("sender")?.takeIf { it.isNotEmpty() } ?: "ShareEven"
    val chat = if (message.hasKey("chat")) message.getString("chat")?.takeIf { it.isNotEmpty() } else null

    // Add to what the chat's notification already shows
    val shown = manager.activeNotifications.firstOrNull { it.tag == conversationId && it.id == 0 }?.notification
    val style = shown?.let { NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(it) }
      ?: NotificationCompat.MessagingStyle(Person.Builder().setName("You").build())
    style.conversationTitle = chat
    style.isGroupConversation = chat != null
    style.addMessage(text, System.currentTimeMillis(), Person.Builder().setName(sender).build())
    while (style.messages.size > MAX_MESSAGES) style.messages.removeAt(0)

    val open = Intent(context, MainActivity::class.java).apply {
      action = "$ACTION_OPEN_CHAT.$conversationId" // one PendingIntent per chat
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(EXTRA_CONVERSATION, conversationId)
    }
    val pending = PendingIntent.getActivity(
      context, conversationId.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(R.drawable.ic_notification)
      .setColor(ContextCompat.getColor(context, R.color.notification_accent))
      .setStyle(style)
      .setContentIntent(pending)
      .setAutoCancel(true)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .build()
    try {
      manager.notify(conversationId, 0, notification)
    } catch (e: SecurityException) {
      // notifications not allowed on this phone
    }
  }

  /** The chat whose notification opened the app (once), or null. */
  @ReactMethod
  fun initialChat(promise: Promise) {
    val intent = reactApplicationContext.currentActivity?.intent
    val id = intent?.getStringExtra(EXTRA_CONVERSATION)
    intent?.removeExtra(EXTRA_CONVERSATION)
    promise.resolve(id)
  }

  /** The notifications of these chats (conversation ids). */
  @ReactMethod
  fun clear(conversationIds: ReadableArray) {
    val shown = manager.activeNotifications.mapNotNull { it.tag }.toSet()
    for (i in 0 until conversationIds.size()) {
      val id = conversationIds.getString(i) ?: continue
      if (id in shown) manager.cancel(id, 0)
    }
  }

  /** Everything (signing out). */
  @ReactMethod
  fun clearAll() {
    manager.cancelAll()
  }

  // For NativeEventEmitter
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  companion object {
    const val CHANNEL = "messages" // created in MainApplication
    const val EVENT_OPEN_CHAT = "ShareEvenOpenChat"
    private const val ACTION_OPEN_CHAT = "com.shareeven.app.OPEN_CHAT"
    private const val EXTRA_CONVERSATION = "shareeven.conversationId"
    private const val MAX_MESSAGES = 8
    private var current: WeakReference<NotificationsModule>? = null

    /** The app was already open (in the background) when a chat notification was tapped. */
    fun onNewIntent(intent: Intent) {
      val id = intent.getStringExtra(EXTRA_CONVERSATION) ?: return
      intent.removeExtra(EXTRA_CONVERSATION)
      current?.get()?.reactApplicationContext?.emitDeviceEvent(EVENT_OPEN_CHAT, id)
    }
  }
}

class NotificationsPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(NotificationsModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
