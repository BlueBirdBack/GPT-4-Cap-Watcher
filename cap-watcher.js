class CapWatcher {
  static DEFAULT_CAP_LIMIT = 25
  static DEFAULT_TIME_FRAME = 3
  static MS_IN_HOUR = 60 * 60 * 1000

  constructor(updateBadgeCallback) {
    this.updateBadgeCallback = updateBadgeCallback
    this.initializeStorage(updateBadgeCallback)
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

export default CapWatcher
