// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

// Global objects
var avatarSynthesizer
var peerConnection
var useTcpForWebRTC = false
var previousAnimationFrameTimestamp = 0;
const storagePrefix = 'talkingAvatarBasic.'
const persistedSettings = [
    { id: 'region' },
    { id: 'APIKey', event: 'input' },
    { id: 'enablePrivateEndpoint', type: 'checkbox' },
    { id: 'privateEndpoint', event: 'input' },
    { id: 'ttsVoice', event: 'input' },
    { id: 'customVoiceEndpointId', event: 'input' },
    { id: 'talkingAvatarCharacter', event: 'input' },
    { id: 'talkingAvatarStyle', event: 'input' },
    { id: 'backgroundColor', event: 'input' },
    { id: 'backgroundImageUrl', event: 'input' },
    { id: 'photoAvatar', type: 'checkbox' },
    { id: 'customizedAvatar', type: 'checkbox' },
    { id: 'useBuiltInVoice', type: 'checkbox' },
    { id: 'transparentBackground', type: 'checkbox' },
    { id: 'videoCrop', type: 'checkbox' },
    { id: 'showSubtitles', type: 'checkbox' },
    { id: 'spokenText', event: 'input' }
]
const persistedSettingsMap = {}
persistedSettings.forEach((setting) => {
    persistedSettingsMap[setting.id] = setting
})
let localStorageEnabled = false
let initializingSettings = false

const LOG_LEVELS = [ 'info', 'warn', 'error' ]
const LOG_LEVEL_LABELS = {
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR'
}
const logEntries = []
let activeLogLevels = new Set(LOG_LEVELS)
const logFilters = {}
let loggingElement = null
let logPlaceholderElement = null
let masterLogFilterElement = null
let consoleMirroringInitialized = false
let currentAvatarMaxWidth = '960px'
let currentAvatarFrameWidth = 1920
let currentAvatarFrameHeight = 1080
const originalConsole = {
    log: console.log ? console.log.bind(console) : () => {},
    info: console.info ? console.info.bind(console) : (console.log ? console.log.bind(console) : () => {}),
    warn: console.warn ? console.warn.bind(console) : (console.log ? console.log.bind(console) : () => {}),
    error: console.error ? console.error.bind(console) : (console.log ? console.log.bind(console) : () => {}),
    debug: console.debug ? console.debug.bind(console) : (console.log ? console.log.bind(console) : () => {})
}

function isLocalStorageAvailable() {
    try {
        const testKey = storagePrefix + '__test'
        window.localStorage.setItem(testKey, '1')
        window.localStorage.removeItem(testKey)
        return true
    } catch (error) {
        console.warn('Local storage is not available.')
        return false
    }
}

function readStoredValue(key) {
    try {
        return window.localStorage.getItem(key)
    } catch (error) {
        console.warn('Failed to read local storage.')
        return null
    }
}

function writeStoredValue(key, value) {
    try {
        window.localStorage.setItem(key, value)
    } catch (error) {
        console.warn('Failed to write local storage.')
    }
}

function persistSettingValueById(id) {
    if (!localStorageEnabled) {
        return
    }

    const setting = persistedSettingsMap[id]
    if (!setting) {
        return
    }

    const element = document.getElementById(id)
    if (!element) {
        return
    }

    const value = setting.type === 'checkbox' ? element.checked : element.value
    const storedValue = setting.type === 'checkbox' ? String(value) : value
    writeStoredValue(storagePrefix + id, storedValue)
}

function initSettingsPersistence() {
    localStorageEnabled = isLocalStorageAvailable()
    initializingSettings = true

    persistedSettings.forEach((setting) => {
        const element = document.getElementById(setting.id)
        if (!element) {
            return
        }

        const storageKey = storagePrefix + setting.id
        const storedValue = localStorageEnabled ? readStoredValue(storageKey) : null
        if (storedValue !== null) {
            if (setting.type === 'checkbox') {
                element.checked = storedValue === 'true'
            } else {
                element.value = storedValue
            }
        }

        const eventName = setting.event || (setting.type === 'checkbox' ? 'change' : 'change')
        element.addEventListener(eventName, () => {
            persistSettingValueById(setting.id)
        })
    })
    window.updatePrivateEndpoint()
    window.updateCustomAvatarBox()
    window.updataTransparentBackground()
    initializingSettings = false
}

function obtainLoggingElements() {
    if (!loggingElement) {
        loggingElement = document.getElementById('logging')
    }
    if (!logPlaceholderElement) {
        logPlaceholderElement = document.getElementById('logPlaceholder')
    }
}

function formatLogArguments(parts) {
    return parts
        .map((part) => {
            if (part instanceof Error) {
                return part.stack || part.message || String(part)
            }
            if (part === undefined || part === null) {
                return ''
            }
            if (typeof part === 'string') {
                return part
            }
            if (typeof part === 'number' || typeof part === 'boolean') {
                return String(part)
            }
            try {
                return JSON.stringify(part)
            } catch (error) {
                return String(part)
            }
        })
        .filter((value) => value !== '')
        .join(' ')
        .trim()
}

function formatLogTimestamp(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return ''
    }

    return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function ensureLogEntryElement(entry) {
    obtainLoggingElements()
    if (!loggingElement || entry.element) {
        return
    }

    const wrapper = document.createElement('div')
    wrapper.className = `log-entry log-entry-${entry.level}`
    wrapper.dataset.logLevel = entry.level

    const header = document.createElement('div')
    header.className = 'log-entry-header'

    const badge = document.createElement('span')
    badge.className = `log-level-badge log-level-badge-${entry.level}`
    badge.textContent = LOG_LEVEL_LABELS[entry.level] || entry.level.toUpperCase()

    const timestamp = document.createElement('span')
    timestamp.className = 'log-entry-timestamp'
    timestamp.textContent = formatLogTimestamp(entry.timestamp)

    header.appendChild(badge)
    header.appendChild(timestamp)

    const message = document.createElement('div')
    message.className = 'log-entry-message'
    message.textContent = entry.message

    wrapper.appendChild(header)
    wrapper.appendChild(message)

    if (loggingElement.firstChild) {
        loggingElement.insertBefore(wrapper, loggingElement.firstChild)
    } else {
        loggingElement.appendChild(wrapper)
    }
    entry.element = wrapper
}

function applyLogFiltersToEntry(entry) {
    entry.hiddenByFilter = !activeLogLevels.has(entry.level)
    if (entry.element) {
        entry.element.hidden = entry.hiddenByFilter
    }
}

function scrollLogContainerToTop() {
    if (!loggingElement) {
        return
    }

    const scrollHost = loggingElement.parentElement || loggingElement
    scrollHost.scrollTop = 0
}

function updateLogPlaceholderVisibility() {
    obtainLoggingElements()
    const hasEntries = logEntries.length > 0
    const hasVisibleEntries = logEntries.some((entry) => !entry.hiddenByFilter)

    if (loggingElement) {
        loggingElement.hidden = !hasVisibleEntries
    }

    if (logPlaceholderElement) {
        if (!hasEntries) {
            logPlaceholderElement.textContent = 'Session and synthesis logs will appear here.'
        } else if (!hasVisibleEntries) {
            logPlaceholderElement.textContent = 'No log entries match the current filters.'
        }
        logPlaceholderElement.hidden = hasVisibleEntries
    }
}

function applyLogLevelFilters() {
    logEntries.forEach((entry) => {
        ensureLogEntryElement(entry)
        applyLogFiltersToEntry(entry)
    })
    updateLogPlaceholderVisibility()
}

function syncMasterLogFilterCheckbox() {
    if (!masterLogFilterElement) {
        return
    }

    const enabledCount = LOG_LEVELS.reduce((count, level) => count + (activeLogLevels.has(level) ? 1 : 0), 0)
    masterLogFilterElement.checked = enabledCount === LOG_LEVELS.length
    masterLogFilterElement.indeterminate = enabledCount > 0 && enabledCount < LOG_LEVELS.length
}

function emitLog(level, parts, options = {}) {
    const message = formatLogArguments(parts)
    if (!message) {
        return
    }

    const entry = {
        level,
        message,
        timestamp: options.timestamp instanceof Date ? options.timestamp : new Date(),
        element: null,
        hiddenByFilter: !activeLogLevels.has(level)
    }

    logEntries.push(entry)

    ensureLogEntryElement(entry)
    if (entry.element) {
        applyLogFiltersToEntry(entry)
        if (!entry.hiddenByFilter) {
            scrollLogContainerToTop()
        }
    }

    updateLogPlaceholderVisibility()

    if (!options.skipConsole) {
        const consoleFn = level === 'warn'
            ? originalConsole.warn
            : level === 'error'
                ? originalConsole.error
                : originalConsole.log
        consoleFn(...parts)
    }
}

const log = (msg) => {
    emitLog('info', [ msg ])
}

function initializeLogUi() {
    obtainLoggingElements()
    loggingElement = document.getElementById('logging')
    logPlaceholderElement = document.getElementById('logPlaceholder')
    masterLogFilterElement = document.getElementById('logFilter-all')

    LOG_LEVELS.forEach((level) => {
        const checkbox = document.getElementById(`logFilter-${level}`)
        if (!checkbox) {
            return
        }

        logFilters[level] = checkbox
        checkbox.checked = activeLogLevels.has(level)
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                activeLogLevels.add(level)
            } else {
                activeLogLevels.delete(level)
            }
            syncMasterLogFilterCheckbox()
            applyLogLevelFilters()
        })
    })

    if (masterLogFilterElement) {
        masterLogFilterElement.checked = LOG_LEVELS.every((level) => activeLogLevels.has(level))
        masterLogFilterElement.indeterminate = false
        masterLogFilterElement.addEventListener('change', () => {
            const checked = masterLogFilterElement.checked
            masterLogFilterElement.indeterminate = false
            activeLogLevels = checked ? new Set(LOG_LEVELS) : new Set()
            LOG_LEVELS.forEach((level) => {
                if (logFilters[level]) {
                    logFilters[level].checked = checked
                }
            })
            applyLogLevelFilters()
            syncMasterLogFilterCheckbox()
        })
    }

    logEntries.forEach((entry) => {
        ensureLogEntryElement(entry)
    })
    applyLogLevelFilters()
    syncMasterLogFilterCheckbox()
}

function setupConsoleMirroring() {
    if (consoleMirroringInitialized) {
        return
    }

    consoleMirroringInitialized = true

    console.log = (...args) => {
        emitLog('info', args, { skipConsole: true })
        originalConsole.log(...args)
    }

    console.info = (...args) => {
        emitLog('info', args, { skipConsole: true })
        originalConsole.info(...args)
    }

    console.debug = (...args) => {
        emitLog('info', args, { skipConsole: true })
        originalConsole.debug(...args)
    }

    console.warn = (...args) => {
        emitLog('warn', args, { skipConsole: true })
        originalConsole.warn(...args)
    }

    console.error = (...args) => {
        emitLog('error', args, { skipConsole: true })
        originalConsole.error(...args)
    }
}

setupConsoleMirroring()

function showRemoteVideo() {
    const remoteVideo = document.getElementById('remoteVideo')
    if (remoteVideo) {
        remoteVideo.style.display = ''
    }
}

function hideRemoteVideo() {
    const remoteVideo = document.getElementById('remoteVideo')
    if (remoteVideo) {
        remoteVideo.style.display = 'none'
    }
}

function applyCanvasDimensions() {
    const canvas = document.getElementById('canvas')
    if (!canvas) {
        return
    }

    canvas.classList.add('avatar-video')
    canvas.style.maxWidth = currentAvatarMaxWidth
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    canvas.style.aspectRatio = `${currentAvatarFrameWidth} / ${currentAvatarFrameHeight}`
}

function syncCanvasWithVideoDimensions(videoElement) {
    if (!videoElement) {
        return
    }

    const width = videoElement.videoWidth || currentAvatarFrameWidth
    const height = videoElement.videoHeight || currentAvatarFrameHeight

    if (!width || !height) {
        return
    }

    currentAvatarFrameWidth = width
    currentAvatarFrameHeight = height

    const canvas = document.getElementById('canvas')
    const tmpCanvas = document.getElementById('tmpCanvas')

    if (canvas) {
        if (canvas.width !== width) {
            canvas.width = width
        }
        if (canvas.height !== height) {
            canvas.height = height
        }
        canvas.style.aspectRatio = `${width} / ${height}`
    }

    if (tmpCanvas) {
        if (tmpCanvas.width !== width) {
            tmpCanvas.width = width
        }
        if (tmpCanvas.height !== height) {
            tmpCanvas.height = height
        }
    }

    applyCanvasDimensions()
}

function setVideoElementDimensions(videoElement) {
    const isPhotoAvatar = document.getElementById('photoAvatar')?.checked
    currentAvatarMaxWidth = isPhotoAvatar ? '512px' : '960px'
    if (videoElement) {
        videoElement.classList.add('avatar-video')
        videoElement.style.maxWidth = currentAvatarMaxWidth
        syncCanvasWithVideoDimensions(videoElement)
    }
    applyCanvasDimensions()
}

function resetVideoContainer() {
    const remoteVideoDiv = document.getElementById('remoteVideo')
    if (remoteVideoDiv) {
        while (remoteVideoDiv.firstChild) {
            remoteVideoDiv.removeChild(remoteVideoDiv.firstChild)
        }
        if (document.getElementById('transparentBackground')?.checked) {
            hideRemoteVideo()
        } else {
            showRemoteVideo()
        }
    }

    const overlay = document.getElementById('overlayArea')
    if (overlay) {
        overlay.hidden = true
    }

    const videoLabel = document.getElementById('videoLabel')
    if (videoLabel) {
        videoLabel.hidden = false
    }

    const canvas = document.getElementById('canvas')
    if (canvas) {
        const context = canvas.getContext('2d')
        context?.clearRect(0, 0, canvas.width, canvas.height)
        canvas.hidden = true
        applyCanvasDimensions()
    }
}

// Setup WebRTC
function setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential) {
    // Create WebRTC peer connection
    peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: [ useTcpForWebRTC ? iceServerUrl.replace(':3478', ':443?transport=tcp') : iceServerUrl ],
            username: iceServerUsername,
            credential: iceServerCredential
        }],
        iceTransportPolicy: useTcpForWebRTC ? 'relay' : 'all'
    })

    // Fetch WebRTC video stream and mount it to an HTML video element
    peerConnection.ontrack = function (event) {
        const remoteVideoDiv = document.getElementById('remoteVideo')
        if (!remoteVideoDiv) {
            return
        }

        for (let i = remoteVideoDiv.childNodes.length - 1; i >= 0; i--) {
            if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
                remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i])
            }
        }

        const mediaPlayer = document.createElement(event.track.kind)
        mediaPlayer.id = event.track.kind
        mediaPlayer.srcObject = event.streams[0]
        mediaPlayer.autoplay = false
        mediaPlayer.preload = 'auto'
        mediaPlayer.addEventListener('loadeddata', () => {
            mediaPlayer.play()
        })

        remoteVideoDiv.appendChild(mediaPlayer)
        document.getElementById('videoLabel').hidden = true
        document.getElementById('overlayArea').hidden = false

        if (event.track.kind === 'video') {
            mediaPlayer.playsInline = true
            setVideoElementDimensions(mediaPlayer)
            const canvas = document.getElementById('canvas')

            mediaPlayer.addEventListener('loadedmetadata', () => {
                syncCanvasWithVideoDimensions(mediaPlayer)
            })

            if (document.getElementById('transparentBackground').checked) {
                hideRemoteVideo()
                if (canvas) {
                    const context = canvas.getContext('2d')
                    context?.clearRect(0, 0, canvas.width, canvas.height)
                    canvas.hidden = false
                    syncCanvasWithVideoDimensions(mediaPlayer)
                    applyCanvasDimensions()
                }
            } else {
                showRemoteVideo()
                if (canvas) {
                    canvas.hidden = true
                }
            }

            mediaPlayer.addEventListener('play', () => {
                syncCanvasWithVideoDimensions(mediaPlayer)
                if (document.getElementById('transparentBackground').checked) {
                    window.requestAnimationFrame(makeBackgroundTransparent)
                }
            })
        } else {
            mediaPlayer.style.display = 'none'
            mediaPlayer.muted = true
        }
    }

    // Listen to data channel, to get the event from the server
    peerConnection.addEventListener("datachannel", event => {
        const dataChannel = event.channel
        dataChannel.onmessage = e => {
            let spokenText = document.getElementById('spokenText').value
            let subtitles = document.getElementById('subtitles')
            const webRTCEvent = JSON.parse(e.data)
            if (webRTCEvent.event.eventType === 'EVENT_TYPE_TURN_START' && document.getElementById('showSubtitles').checked) {
                subtitles.hidden = false
                subtitles.innerHTML = spokenText
            } else if (webRTCEvent.event.eventType === 'EVENT_TYPE_SESSION_END' || webRTCEvent.event.eventType === 'EVENT_TYPE_SWITCH_TO_IDLE') {
                subtitles.hidden = true
            }
            console.log("[" + (new Date()).toISOString() + "] WebRTC event received: " + e.data)
        }
    })

    // This is a workaround to make sure the data channel listening is working by creating a data channel from the client side
    c = peerConnection.createDataChannel("eventChannel")

    // Make necessary update to the web page when the connection state changes
    peerConnection.oniceconnectionstatechange = e => {
        log("WebRTC status: " + peerConnection.iceConnectionState)

        if (peerConnection.iceConnectionState === 'connected') {
            document.getElementById('stopSession').disabled = false
            document.getElementById('speak').disabled = false
            document.getElementById('configuration').hidden = true
        }

        if (peerConnection.iceConnectionState === 'disconnected' || peerConnection.iceConnectionState === 'failed') {
            document.getElementById('speak').disabled = true
            document.getElementById('stopSpeaking').disabled = true
            document.getElementById('stopSession').disabled = true
            document.getElementById('startSession').disabled = false
            document.getElementById('configuration').hidden = false
            resetVideoContainer()
        }
    }

    // Offer to receive 1 audio, and 1 video track
    peerConnection.addTransceiver('video', { direction: 'sendrecv' })
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' })

    // start avatar, establish WebRTC connection
    avatarSynthesizer.startAvatarAsync(peerConnection).then((r) => {
        if (r.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log("[" + (new Date()).toISOString() + "] Avatar started. Result ID: " + r.resultId)
        } else {
            console.log("[" + (new Date()).toISOString() + "] Unable to start avatar. Result ID: " + r.resultId)
            if (r.reason === SpeechSDK.ResultReason.Canceled) {
                let cancellationDetails = SpeechSDK.CancellationDetails.fromResult(r)
                if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
                    console.log(cancellationDetails.errorDetails)
                };
                log("Unable to start avatar: " + cancellationDetails.errorDetails);
            }
            document.getElementById('startSession').disabled = false;
            document.getElementById('configuration').hidden = false;
        }
    }).catch(
        (error) => {
            console.log("[" + (new Date()).toISOString() + "] Avatar failed to start. Error: " + error)
            log("Avatar failed to start. " + error)
            document.getElementById('startSession').disabled = false
            document.getElementById('configuration').hidden = false
        }
    );
}

// Make video background transparent by matting
function makeBackgroundTransparent(timestamp) {
    // Throttle the frame rate to 30 FPS to reduce CPU usage
    if (timestamp - previousAnimationFrameTimestamp > 30) {
        video = document.getElementById('video')
        tmpCanvas = document.getElementById('tmpCanvas')
        syncCanvasWithVideoDimensions(video)
        if (!tmpCanvas || !video) {
            previousAnimationFrameTimestamp = timestamp
            window.requestAnimationFrame(makeBackgroundTransparent)
            return
        }

        tmpCanvasContext = tmpCanvas.getContext('2d', { willReadFrequently: true })
        tmpCanvasContext.drawImage(video, 0, 0, video.videoWidth, video.videoHeight)
        if (video.videoWidth > 0) {
            let frame = tmpCanvasContext.getImageData(0, 0, video.videoWidth, video.videoHeight)
            for (let i = 0; i < frame.data.length / 4; i++) {
                let r = frame.data[i * 4 + 0]
                let g = frame.data[i * 4 + 1]
                let b = frame.data[i * 4 + 2]
                if (g - 150 > r + b) {
                    // Set alpha to 0 for pixels that are close to green
                    frame.data[i * 4 + 3] = 0
                } else if (g + g > r + b) {
                    // Reduce green part of the green pixels to avoid green edge issue
                    adjustment = (g - (r + b) / 2) / 3
                    r += adjustment
                    g -= adjustment * 2
                    b += adjustment
                    frame.data[i * 4 + 0] = r
                    frame.data[i * 4 + 1] = g
                    frame.data[i * 4 + 2] = b
                    // Reduce alpha part for green pixels to make the edge smoother
                    a = Math.max(0, 255 - adjustment * 4)
                    frame.data[i * 4 + 3] = a
                }
            }

            canvas = document.getElementById('canvas')
            canvasContext = canvas.getContext('2d')
            canvasContext.putImageData(frame, 0, 0);
        }

        previousAnimationFrameTimestamp = timestamp
    }

    window.requestAnimationFrame(makeBackgroundTransparent)
}
// Do HTML encoding on given text
function htmlEncode(text) {
    const entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;'
    };

    return String(text).replace(/[&<>"'\/]/g, (match) => entityMap[match])
}

window.startSession = () => {
    const cogSvcRegion = document.getElementById('region').value
    const cogSvcSubKey = document.getElementById('APIKey').value
    if (cogSvcSubKey === '') {
        alert('Please fill in the API key of your speech resource.')
        return
    }

    const privateEndpointEnabled = document.getElementById('enablePrivateEndpoint').checked
    const privateEndpoint = document.getElementById('privateEndpoint').value.slice(8)
    if (privateEndpointEnabled && privateEndpoint === '') {
        alert('Please fill in the Azure Speech endpoint.')
        return
    }

    let speechSynthesisConfig
    let isCustomAvatar = document.getElementById('customizedAvatar').checked
    let isCustomVoice = document.getElementById('customVoiceEndpointId').value !== ''
    let endpoint_route = isCustomAvatar || isCustomVoice ? 'voice' : 'tts'
    if (privateEndpointEnabled) {
        speechSynthesisConfig = SpeechSDK.SpeechConfig.fromEndpoint(new URL(`wss://${privateEndpoint}/${endpoint_route}/cognitiveservices/websocket/v1?enableTalkingAvatar=true`), cogSvcSubKey)
    } else {
        speechSynthesisConfig = SpeechSDK.SpeechConfig.fromSubscription(cogSvcSubKey, cogSvcRegion)
    }
    speechSynthesisConfig.endpointId = document.getElementById('customVoiceEndpointId').value

    const videoFormat = new SpeechSDK.AvatarVideoFormat()
    let videoCropTopLeftX = document.getElementById('videoCrop').checked ? 600 : 0
    let videoCropBottomRightX = document.getElementById('videoCrop').checked ? 1320 : 1920
    videoFormat.setCropRange(new SpeechSDK.Coordinate(videoCropTopLeftX, 0), new SpeechSDK.Coordinate(videoCropBottomRightX, 1080));

    const talkingAvatarCharacter = document.getElementById('talkingAvatarCharacter').value
    const talkingAvatarStyle = document.getElementById('talkingAvatarStyle').value
    const avatarConfig = new SpeechSDK.AvatarConfig(talkingAvatarCharacter, talkingAvatarStyle, videoFormat)
    avatarConfig.photoAvatarBaseModel = document.getElementById('photoAvatar').checked ? 'vasa-1' : ''
    avatarConfig.customized = document.getElementById('customizedAvatar').checked
    avatarConfig.useBuiltInVoice = document.getElementById('useBuiltInVoice').checked 
    avatarConfig.backgroundColor = document.getElementById('backgroundColor').value
    avatarConfig.backgroundImage = document.getElementById('backgroundImageUrl').value

    document.getElementById('startSession').disabled = true
    document.getElementById('configuration').hidden = true
    resetVideoContainer()
    log('Starting avatar session...')
    
    const xhr = new XMLHttpRequest()
    if (privateEndpointEnabled) {
        xhr.open("GET", `https://${privateEndpoint}/tts/cognitiveservices/avatar/relay/token/v1`)
    } else {
        xhr.open("GET", `https://${cogSvcRegion}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`)
    }
    xhr.setRequestHeader("Ocp-Apim-Subscription-Key", cogSvcSubKey)
    xhr.addEventListener("readystatechange", function() {
        if (this.readyState === 4) {
            const responseData = JSON.parse(this.responseText)
            const iceServerUrl = responseData.Urls[0]
            const iceServerUsername = responseData.Username
            const iceServerCredential = responseData.Password

            avatarConfig.remoteIceServers = [{
                urls: [ iceServerUrl ],
                username: iceServerUsername,
                credential: iceServerCredential
            }]

            avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig)
            avatarSynthesizer.avatarEventReceived = function (s, e) {
                var offsetMessage = ", offset from session start: " + e.offset / 10000 + "ms."
                if (e.offset === 0) {
                    offsetMessage = ""
                }
                console.log("[" + (new Date()).toISOString() + "] Event received: " + e.description + offsetMessage)
            }

            setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential)
        }
    })
    xhr.send()
    
}

window.speak = () => {
    document.getElementById('speak').disabled = true;
    document.getElementById('stopSpeaking').disabled = false
    const audioPlayer = document.getElementById('audio')
    if (audioPlayer) {
        audioPlayer.muted = false
    }
    let spokenText = document.getElementById('spokenText').value
    let ttsVoice = document.getElementById('ttsVoice').value
    let spokenSsml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${ttsVoice}'><mstts:leadingsilence-exact value='0'/>${htmlEncode(spokenText)}</voice></speak>`
    console.log("[" + (new Date()).toISOString() + "] Speak request sent.")
    avatarSynthesizer.speakSsmlAsync(spokenSsml).then(
        (result) => {
            document.getElementById('speak').disabled = false
            document.getElementById('stopSpeaking').disabled = true
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                console.log("[" + (new Date()).toISOString() + "] Speech synthesized to speaker for text [ " + spokenText + " ]. Result ID: " + result.resultId)
            } else {
                console.log("[" + (new Date()).toISOString() + "] Unable to speak text. Result ID: " + result.resultId)
                if (result.reason === SpeechSDK.ResultReason.Canceled) {
                    let cancellationDetails = SpeechSDK.CancellationDetails.fromResult(result)
                    console.log(cancellationDetails.reason)
                    if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
                        console.log(cancellationDetails.errorDetails)
                    }
                }
            }
        }).catch(log);
}


window.stopSpeaking = () => {
    document.getElementById('stopSpeaking').disabled = true

    avatarSynthesizer.stopSpeakingAsync().then(() => {
        log("[" + (new Date()).toISOString() + "] Stop speaking request sent.")
    }).catch(log)
}

window.stopSession = () => {
    document.getElementById('speak').disabled = true
    document.getElementById('stopSession').disabled = true
    document.getElementById('stopSpeaking').disabled = true
    document.getElementById('startSession').disabled = false
    document.getElementById('configuration').hidden = false
    resetVideoContainer()
    log("[" + (new Date()).toISOString() + "] Stop session requested.")

    if (avatarSynthesizer !== undefined && avatarSynthesizer !== null) {
        avatarSynthesizer.close()
        avatarSynthesizer = null
    }

    if (peerConnection !== undefined && peerConnection !== null) {
        try {
            peerConnection.close()
        } catch (error) {
            console.warn('Failed to close peer connection.', error)
        }
        peerConnection = null
    }
}

window.onload = () => {
    initializeLogUi()
    resetVideoContainer()
    initSettingsPersistence()
    updateLogPlaceholderVisibility()
    applyCanvasDimensions()
}

window.updataTransparentBackground = () => {
    const isTransparent = document.getElementById('transparentBackground').checked
    const backgroundColorInput = document.getElementById('backgroundColor')
    if (!backgroundColorInput) {
        return
    }
    const canvas = document.getElementById('canvas')

    if (isTransparent) {
        document.body.style.backgroundImage = 'url("./image/background.png")'
        document.body.style.backgroundColor = '#00FF00'
        backgroundColorInput.disabled = true
        if (!initializingSettings) {
            backgroundColorInput.value = '#00FF00FF'
            persistSettingValueById('backgroundColor')
        }
        if (canvas) {
            canvas.hidden = false
        }
        hideRemoteVideo()
        applyCanvasDimensions()
    } else {
        document.body.style.backgroundImage = ''
        document.body.style.backgroundColor = ''
        backgroundColorInput.disabled = false
        if (!initializingSettings) {
            backgroundColorInput.value = '#FFFFFFFF'
            persistSettingValueById('backgroundColor')
        }
        if (canvas) {
            canvas.hidden = true
        }
        showRemoteVideo()
        applyCanvasDimensions()
    }

    if (!initializingSettings) {
        persistSettingValueById('transparentBackground')
    }
}

window.updatePrivateEndpoint = () => {
    if (document.getElementById('enablePrivateEndpoint').checked) {
        document.getElementById('showPrivateEndpointCheckBox').hidden = false
    } else {
        document.getElementById('showPrivateEndpointCheckBox').hidden = true
    }
}

window.updatePhotoAvatarBox = () => {
    if (initializingSettings) {
        return
    }

    const characterInput = document.getElementById('talkingAvatarCharacter')
    const styleInput = document.getElementById('talkingAvatarStyle')
    if (!characterInput || !styleInput) {
        return
    }

    if (document.getElementById('photoAvatar').checked) {
        characterInput.value = 'anika'
        styleInput.value = ''
    } else {
        characterInput.value = 'lisa'
        styleInput.value = 'casual-sitting'
    }

    persistSettingValueById('talkingAvatarCharacter')
    persistSettingValueById('talkingAvatarStyle')

    const videoElement = document.getElementById('video')
    if (videoElement) {
        setVideoElementDimensions(videoElement)
    }
    applyCanvasDimensions()
}

window.updateCustomAvatarBox = () => {
    if (document.getElementById('customizedAvatar').checked) {
        document.getElementById('useBuiltInVoice').disabled = false
    } else {
        document.getElementById('useBuiltInVoice').disabled = true
        document.getElementById('useBuiltInVoice').checked = false
    }
    if (!initializingSettings) {
        persistSettingValueById('useBuiltInVoice')
    }
}
