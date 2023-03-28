;(function () {
  const GPT_4_PRE_SELECTOR = 'main > div > div > div > div > div'
  const GPT_4_SELECTOR = 'GPT-4'
  const MAIN_SELECTOR = 'main'
  const FORM_SELECTOR = 'main > div.absolute.bottom-0 > form'
  const REGENERATE_BUTTON_SELECTOR = '.btn-neutral'
  const SEND_BUTTON_SELECTOR = '.absolute.p-1'
  const TEXTAREA_SELECTOR = 'textarea[data-id]'

  function isGPT4InUse() {
    const modelElement = document.querySelector(GPT_4_PRE_SELECTOR)
    return modelElement && modelElement.textContent.includes(GPT_4_SELECTOR)
  }

  function updateCap() {
    if (isGPT4InUse()) {
      chrome.runtime.sendMessage({
        type: 'updateCap',
      })
    }
  }

  function handleButtonClick(e) {
    updateCap()
  }

  function handleTextareaKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      updateCap()
    }
  }

  function addButtonEventListener(button) {
    if (button) {
      button.removeEventListener('click', handleButtonClick, true)
      button.addEventListener('click', handleButtonClick, true)
    }
  }

  function addTextareaEventListener(textarea) {
    if (textarea) {
      textarea.removeEventListener('keydown', handleTextareaKeydown, true)
      textarea.addEventListener('keydown', handleTextareaKeydown, true)
    }
  }

  function observeDOMChanges() {
    const mainArea = document.querySelector(MAIN_SELECTOR)
    const observerConfig = { childList: true, subtree: true }

    const mutationObserver = new MutationObserver((mutations, observer) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const form = document.querySelector(FORM_SELECTOR)

          if (form) {
            const sendButton = form.querySelector(SEND_BUTTON_SELECTOR)
            addButtonEventListener(sendButton)

            const regenerateButton = form.querySelector(
              REGENERATE_BUTTON_SELECTOR
            )
            addButtonEventListener(regenerateButton)

            const textarea = form.querySelector(TEXTAREA_SELECTOR)
            addTextareaEventListener(textarea)
          }
        }
      }
    })

    mutationObserver.observe(mainArea, observerConfig)
  }

  function checkMainAreaAndObserve() {
    if (document.querySelector(MAIN_SELECTOR)) {
      observeDOMChanges()
    } else {
      setTimeout(checkMainAreaAndObserve, 500) // Retry after 500ms
    }
  }

  // Debounce function
  function debounce(func, wait = 2000) {
    let timeout
    return function (...args) {
      const context = this
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(context, args), wait)
    }
  }

  // Function to handle URL change
  function handleUrlChange() {
    checkMainAreaAndObserve()
  }

  // Debounced version of handleUrlChange
  const debouncedHandleUrlChange = debounce(handleUrlChange)

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'urlChanged') {
      debouncedHandleUrlChange()
      sendResponse({ status: 'success' })
    }
  })

  // Send a "ready" message to the background script
  chrome.runtime.sendMessage({ message: 'contentReady' })
})()
