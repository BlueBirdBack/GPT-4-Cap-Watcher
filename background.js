const urlPattern = /^https:\/\/chat\.openai\.com\/chat\//

function sendMessageWithRetry(tabId, message, retries = 10, delay = 500) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (
      chrome.runtime.lastError ||
      (response && response.status !== 'success')
    ) {
      if (retries > 0) {
        setTimeout(() => {
          sendMessageWithRetry(tabId, message, retries - 1, delay)
        }, delay)
      } else {
        console.error('Failed to send message:', chrome.runtime.lastError)
      }
    }
  })
}

// Listen for URL changes
chrome.webNavigation.onCompleted.addListener(
  ({ tabId, url }) => {
    if (url && urlPattern.test(url)) {
      sendMessageWithRetry(tabId, { message: 'urlChanged' })
    }
  },
  { url: [{ schemes: ['http', 'https'] }] }
)

// Listen for history state updates (including query parameter changes)
chrome.webNavigation.onHistoryStateUpdated.addListener(
  ({ tabId, url }) => {
    if (url && urlPattern.test(url)) {
      sendMessageWithRetry(tabId, { message: 'urlChanged' })
    }
  },
  { url: [{ schemes: ['http', 'https'] }] }
)

// Listen for new tabs
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url && urlPattern.test(tab.url)) {
    sendMessageWithRetry(tab.id, { message: 'urlChanged' })
  }
})

// Listen for the "contentReady" message from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'contentReady') {
    const tabId = sender.tab.id

    // Check the current URL of the sender tab
    chrome.tabs.get(tabId, (tab) => {
      if (tab.url) {
        sendMessageWithRetry(tabId, { message: 'urlChanged' })
      }
    })
  }
})

// CapWatcher

class CapWatcher {
  static DEFAULT_CAP_LIMIT = 25
  static DEFAULT_TIME_FRAME = 3
  static MS_IN_HOUR = 60 * 60 * 1000

  constructor() {
    this.initializeStorage(updateBadge)
  }

  initializeStorage(callback) {
    chrome.storage.sync.get(
      ['capLimit', 'timeFrame', 'messageCount', 'capStartTime'],
      (data) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError)
          return
        }

        this.updateStorage(
          {
            capLimit: data.capLimit ?? CapWatcher.DEFAULT_CAP_LIMIT,
            timeFrame: data.timeFrame ?? CapWatcher.DEFAULT_TIME_FRAME,
            messageCount: data.messageCount ?? 0,
            capStartTime: data.capStartTime ?? Date.now(),
          },
          callback
        )
      }
    )
  }

  updateStorage(values, callback) {
    chrome.storage.sync.set(values, () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError)
        return
      }
      if (callback) {
        callback()
      }
    })
  }

  resetStorage(callback) {
    this.updateStorage(
      {
        // capLimit: CapWatcher.DEFAULT_CAP_LIMIT,
        // timeFrame: CapWatcher.DEFAULT_TIME_FRAME,
        messageCount: 0,
        capStartTime: Date.now(),
      },
      callback
    )
  }

  async getStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(key, (data) => {
        resolve(data[key])
      })
    })
  }

  updateCapLimit(capLimit) {
    this.updateStorage({ capLimit: capLimit })
  }

  updateTimeFrame(timeFrame) {
    this.updateStorage({ timeFrame: timeFrame })
  }

  updateMessageCount(messageCount) {
    this.updateStorage({ messageCount: messageCount })
  }

  updateCapStartTime(capStartTime) {
    this.updateStorage({ capStartTime: capStartTime })
  }

  async incrementMessageCount() {
    let messageCount = await this.getMessageCount()
    const capLimit = await this.getCapLimit()

    messageCount++
    this.updateMessageCount(messageCount)

    if (messageCount === 1) {
      this.updateCapStartTime(Date.now())
    }
  }

  async getCapLimit() {
    return this.getStorage('capLimit')
  }

  async getTimeFrame() {
    return this.getStorage('timeFrame')
  }

  async getMessageCount() {
    return this.getStorage('messageCount')
  }

  async getCapStartTime() {
    return this.getStorage('capStartTime')
  }
}

const capWatcher = new CapWatcher()

const CONTENT_SCRIPT_PATH = 'content.js'

const TEXT_COLOR = '#FFFFFF' // white
const LOW_MESSAGES_BADGE_COLOR = '#F44336' // red
const MEDIUM_MESSAGES_BADGE_COLOR = '#FF9800' // orange
const HIGH_MESSAGES_BADGE_COLOR = '#4CAF50' // green

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'updateCap') {
    await capWatcher.incrementMessageCount()
    updateBadge()
  }
})

async function updateBadge() {
  const capLimit = await capWatcher.getCapLimit()
  const timeFrame = await capWatcher.getTimeFrame()
  let messageCount = await capWatcher.getMessageCount()
  let capStartTime = await capWatcher.getCapStartTime()

  let timeElapsed = Date.now() - capStartTime

  if (timeElapsed >= timeFrame * CapWatcher.MS_IN_HOUR) {
    // capWatcher.resetStorage()
    await new Promise((resolve) => {
      capWatcher.resetStorage(resolve)
    })
    messageCount = await capWatcher.getMessageCount()
  }

  let remainingMessages = capLimit - messageCount

  chrome.action.setBadgeText({ text: remainingMessages.toString() })
  chrome.action.setBadgeTextColor({ color: TEXT_COLOR })

  // Update the badge title
  const hours =
    (timeFrame * CapWatcher.MS_IN_HOUR - timeElapsed) / CapWatcher.MS_IN_HOUR
  const seconds = hours * 60 * 60
  // const timeLeft = `${Math.floor(hours)} hours`
  const timeLeft = `${Math.floor(seconds).toLocaleString()} seconds`

  chrome.action.setTitle({
    title: `Remaining messages: ${remainingMessages}\nTime left: ${timeLeft}`,
  })

  // Update badge color based on remaining messages
  let badgeColor = HIGH_MESSAGES_BADGE_COLOR
  if (remainingMessages <= 5) {
    badgeColor = LOW_MESSAGES_BADGE_COLOR
  } else if (remainingMessages <= 10) {
    badgeColor = MEDIUM_MESSAGES_BADGE_COLOR
  }
  chrome.action.setBadgeBackgroundColor({ color: badgeColor })
}

// updateBadge()

setInterval(updateBadge, 60000)
