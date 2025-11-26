// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

// Global objects
var speechRecognizer
var avatarSynthesizer
var peerConnection
var peerConnectionDataChannel
var messages = []
var messageInitiated = false
var dataSources = []
var sentenceLevelPunctuations = [ '.', '?', '!', ':', ';', '。', '？', '！', '：', '；' ]
var enableDisplayTextAlignmentWithSpeech = true
var enableQuickReply = false
var quickReplies = [ 'Let me take a look.', 'Let me check.', 'One moment, please.' ]
var byodDocRegex = new RegExp(/\[doc(\d+)\]/g)
var isSpeaking = false
var isReconnecting = false
var speakingText = ""
var spokenTextQueue = []
var repeatSpeakingSentenceAfterReconnection = true
var sessionActive = false
var userClosedSession = false
var lastInteractionTime = new Date()
var lastSpeakTime
var imgUrl = ""
let currentAssistantBubble = null
const storagePrefix = 'talkingAvatarChat.'
const persistedSettings = [
    { id: 'region' },
    { id: 'APIKey', event: 'input' },
    { id: 'enablePrivateEndpoint', type: 'checkbox' },
    { id: 'privateEndpoint', event: 'input' },
    { id: 'azureOpenAIEndpoint', event: 'input' },
    { id: 'azureOpenAIApiKey', event: 'input' },
    { id: 'azureOpenAIDeploymentName', event: 'input' },
    { id: 'prompt', event: 'input' },
    { id: 'enableOyd', type: 'checkbox' },
    { id: 'azureCogSearchEndpoint', event: 'input' },
    { id: 'azureCogSearchApiKey', event: 'input' },
    { id: 'azureCogSearchIndexName', event: 'input' },
    { id: 'sttLocales', event: 'input' },
    { id: 'ttsVoice', event: 'input' },
    { id: 'customVoiceEndpointId', event: 'input' },
    { id: 'continuousConversation', type: 'checkbox' },
    { id: 'talkingAvatarCharacter', event: 'input' },
    { id: 'talkingAvatarStyle', event: 'input' },
    { id: 'photoAvatar', type: 'checkbox' },
    { id: 'customizedAvatar', type: 'checkbox' },
    { id: 'useBuiltInVoice', type: 'checkbox' },
    { id: 'autoReconnectAvatar', type: 'checkbox' },
    { id: 'useLocalVideoForIdle', type: 'checkbox' },
    { id: 'showSubtitles', type: 'checkbox' }
]
const persistedSettingsMap = {}
persistedSettings.forEach((setting) => {
    persistedSettingsMap[setting.id] = setting
})
let localStorageEnabled = false

function logDiagnostic(scope, event, payload = {}) {
    const timestamp = new Date().toISOString()
    const hasPayload = payload && Object.keys(payload).length > 0
    const prefix = `[${timestamp}] [${scope}] ${event}`
    if (hasPayload) {
        console.log(prefix, payload)
    } else {
        console.log(prefix)
    }
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
    if (!localStorageEnabled) {
        return
    }
    persistedSettings.forEach((setting) => {
        const element = document.getElementById(setting.id)
        if (!element) {
            return
        }
        const storageKey = storagePrefix + setting.id
        const storedValue = readStoredValue(storageKey)
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
    if (document.getElementById('enablePrivateEndpoint')) {
        window.updatePrivateEndpoint()
    }
    if (document.getElementById('enableOyd')) {
        window.updataEnableOyd()
    }
    if (document.getElementById('customizedAvatar')) {
        window.updateCustomAvatarBox()
    }
    if (document.getElementById('useLocalVideoForIdle')) {
        window.updateLocalVideoForIdle()
    }
}

// Connect to avatar service
function connectAvatar() {
    const cogSvcRegion = document.getElementById('region').value
    const cogSvcSubKey = document.getElementById('APIKey').value
    if (cogSvcSubKey === '') {
        alert('Please fill in the API key of your speech resource.')
        return
    }

    const privateEndpointEnabled = document.getElementById('enablePrivateEndpoint').checked
    logDiagnostic('ConnectAvatar', 'InputsValidated', {
        region: cogSvcRegion,
        privateEndpointEnabled,
        origin: window.location.origin
    })

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

    const talkingAvatarCharacter = document.getElementById('talkingAvatarCharacter').value
    const talkingAvatarStyle = document.getElementById('talkingAvatarStyle').value
    const avatarConfig = new SpeechSDK.AvatarConfig(talkingAvatarCharacter, talkingAvatarStyle)
    avatarConfig.photoAvatarBaseModel = document.getElementById('photoAvatar').checked ? 'vasa-1' : ''
    avatarConfig.customized = document.getElementById('customizedAvatar').checked
    avatarConfig.useBuiltInVoice = document.getElementById('useBuiltInVoice').checked
    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig)
    avatarSynthesizer.avatarEventReceived = function (s, e) {
        var offsetMessage = ", offset from session start: " + e.offset / 10000 + "ms."
        if (e.offset === 0) {
            offsetMessage = ""
        }

        console.log("Event received: " + e.description + offsetMessage)
    }

    const speechRecognitionEndpoint = privateEndpointEnabled
        ? `wss://${privateEndpoint}/stt/speech/universal/v2`
        : `wss://${cogSvcRegion}.stt.speech.microsoft.com/speech/universal/v2`
    let speechRecognitionConfig = SpeechSDK.SpeechConfig.fromEndpoint(new URL(speechRecognitionEndpoint), cogSvcSubKey)
    speechRecognitionConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous")
    var sttLocales = document.getElementById('sttLocales').value.split(',')
    var autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(sttLocales)
    speechRecognizer = SpeechSDK.SpeechRecognizer.FromConfig(speechRecognitionConfig, autoDetectSourceLanguageConfig, SpeechSDK.AudioConfig.fromDefaultMicrophoneInput())
    logDiagnostic('SpeechRecognizer', 'Configured', {
        endpoint: speechRecognitionEndpoint,
        region: cogSvcRegion,
        privateEndpointEnabled,
        origin: window.location.origin,
        locales: sttLocales
    })

    speechRecognizer.sessionStarted = (s, e) => {
        logDiagnostic('SpeechRecognizer', 'SessionStarted', {
            sessionId: e.sessionId
        })
    }
    speechRecognizer.sessionStopped = (s, e) => {
        logDiagnostic('SpeechRecognizer', 'SessionStopped', {
            sessionId: e.sessionId
        })
    }
    speechRecognizer.speechStartDetected = (s, e) => {
        logDiagnostic('SpeechRecognizer', 'SpeechStartDetected', {
            sessionId: e.sessionId
        })
    }
    speechRecognizer.speechEndDetected = (s, e) => {
        logDiagnostic('SpeechRecognizer', 'SpeechEndDetected', {
            sessionId: e.sessionId
        })
    }
    speechRecognizer.canceled = (s, e) => {
        logDiagnostic('SpeechRecognizer', 'Canceled', {
            sessionId: e.sessionId,
            reason: e.reason,
            errorDetails: e.errorDetails,
            errorCode: e.errorCode
        })
    }
    speechRecognizer.recognizing = (s, e) => {
        if (e.result && e.result.text) {
            logDiagnostic('SpeechRecognizer', 'Recognizing', {
                textPreview: e.result.text.substring(0, 80),
                reason: e.result.reason,
                sessionId: e.sessionId
            })
        }
    }

    const azureOpenAIEndpoint = document.getElementById('azureOpenAIEndpoint').value
    const azureOpenAIApiKey = document.getElementById('azureOpenAIApiKey').value
    const azureOpenAIDeploymentName = document.getElementById('azureOpenAIDeploymentName').value
    if (azureOpenAIEndpoint === '' || azureOpenAIApiKey === '' || azureOpenAIDeploymentName === '') {
        alert('Please fill in the Azure OpenAI endpoint, API key and deployment name.')
        return
    }

    dataSources = []
    if (document.getElementById('enableOyd').checked) {
        const azureCogSearchEndpoint = document.getElementById('azureCogSearchEndpoint').value
        const azureCogSearchApiKey = document.getElementById('azureCogSearchApiKey').value
        const azureCogSearchIndexName = document.getElementById('azureCogSearchIndexName').value
        if (azureCogSearchEndpoint === "" || azureCogSearchApiKey === "" || azureCogSearchIndexName === "") {
            alert('Please fill in the Azure Cognitive Search endpoint, API key and index name.')
            return
        } else {
            setDataSources(azureCogSearchEndpoint, azureCogSearchApiKey, azureCogSearchIndexName)
        }
    }

    // Only initialize messages once
    if (!messageInitiated) {
        initMessages()
        messageInitiated = true
    }

    document.getElementById('startSession').disabled = true
    document.getElementById('configuration').hidden = true

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
            setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential)
        }
    })
    xhr.send()
}

// Disconnect from avatar service
function disconnectAvatar() {
    logDiagnostic('AvatarSession', 'DisconnectRequested', {
        sessionActive,
        isSpeaking
    })
    if (avatarSynthesizer !== undefined) {
        avatarSynthesizer.close()
    }

    if (speechRecognizer !== undefined) {
        logDiagnostic('SpeechRecognizer', 'StopContinuousRecognitionAsyncInvoked')
        speechRecognizer.stopContinuousRecognitionAsync()
        speechRecognizer.close()
    }

    sessionActive = false
}

// Setup WebRTC
function setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential) {
    // Create WebRTC peer connection
    peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: [ iceServerUrl ],
            username: iceServerUsername,
            credential: iceServerCredential
        }]
    })

    // Fetch WebRTC video stream and mount it to an HTML video element
    peerConnection.ontrack = function (event) {
        if (event.track.kind === 'audio') {
            let audioElement = document.createElement('audio')
            audioElement.id = 'audioPlayer'
            audioElement.srcObject = event.streams[0]
            audioElement.autoplay = false
            audioElement.addEventListener('loadeddata', () => {
                audioElement.play()
            })

            audioElement.onplaying = () => {
                console.log(`WebRTC ${event.track.kind} channel connected.`)
            }

            // Clean up existing audio element if there is any
            remoteVideoDiv = document.getElementById('remoteVideo')
            for (var i = 0; i < remoteVideoDiv.childNodes.length; i++) {
                if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
                    remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i])
                }
            }

            // Append the new audio element
            document.getElementById('remoteVideo').appendChild(audioElement)
        }

        if (event.track.kind === 'video') {
            let videoElement = document.createElement('video')
            videoElement.id = 'videoPlayer'
            videoElement.srcObject = event.streams[0]
            videoElement.autoplay = false
            videoElement.addEventListener('loadeddata', () => {
                videoElement.play()
            })

            videoElement.playsInline = true
            videoElement.classList.add('avatar-video')
            document.getElementById('remoteVideo').appendChild(videoElement)

            // Continue speaking if there are unfinished sentences
            if (repeatSpeakingSentenceAfterReconnection) {
                if (speakingText !== '') {
                    speakNext(speakingText, 0, true)
                }
            } else {
                if (spokenTextQueue.length > 0) {
                    speakNext(spokenTextQueue.shift())
                }
            }

            videoElement.onplaying = () => {
                // Clean up existing video element if there is any
                remoteVideoDiv = document.getElementById('remoteVideo')
                for (var i = 0; i < remoteVideoDiv.childNodes.length; i++) {
                    if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
                        remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i])
                    }
                }

                // Append the new video element
                const isPhotoAvatar = document.getElementById('photoAvatar').checked
                videoElement.style.maxWidth = isPhotoAvatar ? '512px' : '960px'
                videoElement.style.width = '100%'
                videoElement.style.height = 'auto'
                videoElement.style.display = 'block'
                videoElement.style.margin = '0 auto'
                remoteVideoDiv.style.display = ''
                document.getElementById('remoteVideo').appendChild(videoElement)

                console.log(`WebRTC ${event.track.kind} channel connected.`)
                document.getElementById('microphone').disabled = false
                document.getElementById('stopSession').disabled = false
                document.getElementById('chatHistory').hidden = false
                document.getElementById('showTypeMessage').disabled = false
                updateChatHistoryPlaceholderVisibility()

                if (document.getElementById('useLocalVideoForIdle').checked) {
                    document.getElementById('localVideo').hidden = true
                    if (lastSpeakTime === undefined) {
                        lastSpeakTime = new Date()
                    }
                }

                isReconnecting = false
                setTimeout(() => { sessionActive = true }, 5000) // Set session active after 5 seconds
            }
        }
    }
    
     // Listen to data channel, to get the event from the server
    peerConnection.addEventListener("datachannel", event => {
        peerConnectionDataChannel = event.channel
        peerConnectionDataChannel.onmessage = e => {
            let subtitles = document.getElementById('subtitles')
            const webRTCEvent = JSON.parse(e.data)
            if (webRTCEvent.event.eventType === 'EVENT_TYPE_TURN_START' && document.getElementById('showSubtitles').checked) {
                subtitles.hidden = false
                subtitles.innerHTML = speakingText
            } else if (webRTCEvent.event.eventType === 'EVENT_TYPE_SESSION_END' || webRTCEvent.event.eventType === 'EVENT_TYPE_SWITCH_TO_IDLE') {
                subtitles.hidden = true
                if (webRTCEvent.event.eventType === 'EVENT_TYPE_SESSION_END') {
                    if (document.getElementById('autoReconnectAvatar').checked && !userClosedSession && !isReconnecting) {
                        // No longer reconnect when there is no interaction for a while
                        if (new Date() - lastInteractionTime < 300000) {
                            // Session disconnected unexpectedly, need reconnect
                            console.log(`[${(new Date()).toISOString()}] The WebSockets got disconnected, need reconnect.`)
                            isReconnecting = true

                            // Remove data channel onmessage callback to avoid duplicatedly triggering reconnect
                            peerConnectionDataChannel.onmessage = null

                            // Release the existing avatar connection
                            if (avatarSynthesizer !== undefined) {
                                avatarSynthesizer.close()
                            }

                            // Setup a new avatar connection
                            connectAvatar()
                        }
                    }
                }
            }

            console.log("[" + (new Date()).toISOString() + "] WebRTC event received: " + e.data)
        }
    })

    // This is a workaround to make sure the data channel listening is working by creating a data channel from the client side
    c = peerConnection.createDataChannel("eventChannel")

    // Make necessary update to the web page when the connection state changes
    peerConnection.oniceconnectionstatechange = e => {
        console.log("WebRTC status: " + peerConnection.iceConnectionState)
        if (peerConnection.iceConnectionState === 'disconnected') {
            if (document.getElementById('useLocalVideoForIdle').checked) {
                document.getElementById('localVideo').hidden = false
                document.getElementById('remoteVideo').style.display = 'none'
            }
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

                console.log("Unable to start avatar: " + cancellationDetails.errorDetails);
            }
            document.getElementById('startSession').disabled = false;
            document.getElementById('configuration').hidden = false;
        }
    }).catch(
        (error) => {
            console.log("[" + (new Date()).toISOString() + "] Avatar failed to start. Error: " + error)
            document.getElementById('startSession').disabled = false
            document.getElementById('configuration').hidden = false
        }
    )
}

// Initialize messages
function initMessages() {
    messages = []

    if (dataSources.length === 0) {
        let systemPrompt = document.getElementById('prompt').value
        let systemMessage = {
            role: 'system',
            content: systemPrompt
        }

        messages.push(systemMessage)
    }
}

// Set data sources for chat API
function setDataSources(azureCogSearchEndpoint, azureCogSearchApiKey, azureCogSearchIndexName) {
    let dataSource = {
        type: 'AzureCognitiveSearch',
        parameters: {
            endpoint: azureCogSearchEndpoint,
            key: azureCogSearchApiKey,
            indexName: azureCogSearchIndexName,
            semanticConfiguration: '',
            queryType: 'simple',
            fieldsMapping: {
                contentFieldsSeparator: '\n',
                contentFields: ['content'],
                filepathField: null,
                titleField: 'title',
                urlField: null
            },
            inScope: true,
            roleInformation: document.getElementById('prompt').value
        }
    }

    dataSources.push(dataSource)
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

function getChatHistoryElement() {
    return document.getElementById('chatHistory')
}

function getChatHistoryPlaceholder() {
    return document.getElementById('chatHistoryPlaceholder')
}

function scrollChatHistoryToEnd() {
    const history = getChatHistoryElement()
    if (!history) {
        return
    }
    const scroller = history.parentElement
    if (scroller) {
        scroller.scrollTop = scroller.scrollHeight
    }
}

function formatTextToHtml(text) {
    return htmlEncode(text).replace(/\n/g, '<br/>')
}

function appendChatBubble(role, content = '', options = {}) {
    const history = getChatHistoryElement()
    if (!history) {
        return null
    }

    const wrapper = document.createElement('div')
    wrapper.className = role === 'assistant' ? 'flex justify-start' : 'flex justify-end'

    const stack = document.createElement('div')
    stack.className = `flex max-w-[85%] flex-col gap-1 ${role === 'assistant' ? 'items-start' : 'items-end'}`

    const label = document.createElement('span')
    label.className = `text-xs font-semibold uppercase tracking-wide ${role === 'assistant' ? 'text-sky-600' : 'text-emerald-600'}`
    label.textContent = role === 'assistant' ? 'Avatar' : 'You'

    const bubble = document.createElement('div')
    bubble.className = `rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${role === 'assistant' ? 'border border-slate-200 bg-white text-slate-900' : 'bg-sky-600 text-white'}`
    bubble.dataset.role = role

    if (options.asHtml) {
        bubble.innerHTML = content
    } else if (options.raw) {
        bubble.dataset.rawText = content
        bubble.innerHTML = formatTextToHtml(content)
    } else {
        bubble.textContent = content
    }

    stack.appendChild(label)
    stack.appendChild(bubble)
    wrapper.appendChild(stack)
    history.appendChild(wrapper)

    updateChatHistoryPlaceholderVisibility()
    scrollChatHistoryToEnd()

    return bubble
}

function appendRawTextToBubble(bubble, text) {
    if (!bubble) {
        return
    }

    const existingText = bubble.dataset.rawText || ''
    const updatedText = existingText + text
    bubble.dataset.rawText = updatedText
    bubble.innerHTML = formatTextToHtml(updatedText)
    scrollChatHistoryToEnd()
}

function getLatestAssistantBubble() {
    if (currentAssistantBubble && currentAssistantBubble.isConnected) {
        return currentAssistantBubble
    }

    const history = getChatHistoryElement()
    if (!history) {
        return null
    }

    const bubbles = history.querySelectorAll('[data-role="assistant"]')
    if (bubbles.length === 0) {
        return null
    }

    currentAssistantBubble = bubbles[bubbles.length - 1]
    return currentAssistantBubble
}

function ensureAssistantBubble() {
    let bubble = getLatestAssistantBubble()
    if (bubble) {
        return bubble
    }

    bubble = appendChatBubble('assistant', '', { raw: true })
    currentAssistantBubble = bubble
    return bubble
}

function clearChatHistoryUI() {
    const history = getChatHistoryElement()
    if (history) {
        history.innerHTML = ''
    }
    currentAssistantBubble = null
    updateChatHistoryPlaceholderVisibility()
}

function updateChatHistoryPlaceholderVisibility() {
    const history = getChatHistoryElement()
    const placeholder = getChatHistoryPlaceholder()
    if (!placeholder) {
        return
    }

    const shouldShowPlaceholder = !history || history.hidden || history.children.length === 0
    placeholder.hidden = !shouldShowPlaceholder
}

// Speak the given text
function speak(text, endingSilenceMs = 0) {
    if (isSpeaking) {
        spokenTextQueue.push(text)
        return
    }

    speakNext(text, endingSilenceMs)
}

function speakNext(text, endingSilenceMs = 0, skipUpdatingChatHistory = false) {
    let ttsVoice = document.getElementById('ttsVoice').value
     let ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${ttsVoice}'><mstts:leadingsilence-exact value='0'/>${htmlEncode(text)}</voice></speak>`
    if (endingSilenceMs > 0) {
        ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${ttsVoice}'><mstts:leadingsilence-exact value='0'/>${htmlEncode(text)}<break time='${endingSilenceMs}ms' /></voice></speak>`
    }

    if (enableDisplayTextAlignmentWithSpeech && !skipUpdatingChatHistory) {
        const bubble = ensureAssistantBubble()
        appendRawTextToBubble(bubble, text)
    }

    lastSpeakTime = new Date()
    isSpeaking = true
    speakingText = text
    document.getElementById('stopSpeaking').disabled = false
    avatarSynthesizer.speakSsmlAsync(ssml).then(
        (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                console.log(`Speech synthesized to speaker for text [ ${text} ]. Result ID: ${result.resultId}`)
                lastSpeakTime = new Date()
            } else {
                console.log(`Error occurred while speaking the SSML. Result ID: ${result.resultId}`)
            }

            speakingText = ''

            if (spokenTextQueue.length > 0) {
                speakNext(spokenTextQueue.shift())
            } else {
                isSpeaking = false
                document.getElementById('stopSpeaking').disabled = true
            }
        }).catch(
            (error) => {
                console.log(`Error occurred while speaking the SSML: [ ${error} ]`)

                speakingText = ''

                if (spokenTextQueue.length > 0) {
                    speakNext(spokenTextQueue.shift())
                } else {
                    isSpeaking = false
                    document.getElementById('stopSpeaking').disabled = true
                }
            }
        )
}

function stopSpeaking() {
    lastInteractionTime = new Date()
    spokenTextQueue = []
    avatarSynthesizer.stopSpeakingAsync().then(
        () => {
            isSpeaking = false
            document.getElementById('stopSpeaking').disabled = true
            console.log("[" + (new Date()).toISOString() + "] Stop speaking request sent.")
        }
    ).catch(
        (error) => {
            console.log("Error occurred while stopping speaking: " + error)
        }
    )
}

function handleUserQuery(userQuery, userQueryHTML, imgUrlPath) {
    lastInteractionTime = new Date()
    let contentMessage = userQuery
    if (imgUrlPath.trim()) {
        contentMessage = [  
            { 
                "type": "text", 
                "text": userQuery 
            },
            { 
                "type": "image_url",
                "image_url": {
                    "url": imgUrlPath
                }
            }
        ]
    }
    let chatMessage = {
        role: 'user',
        content: contentMessage
    }

    messages.push(chatMessage)
    const hasImage = imgUrlPath.trim() !== ''
    if (hasImage) {
        appendChatBubble('user', userQueryHTML, { asHtml: true })
    } else {
        appendChatBubble('user', userQuery, { raw: true })
    }
    currentAssistantBubble = null

    // Stop previous speaking if there is any
    if (isSpeaking) {
        stopSpeaking()
    }

    // For 'bring your data' scenario, chat API currently has long (4s+) latency
    // We return some quick reply here before the chat API returns to mitigate.
    if (dataSources.length > 0 && enableQuickReply) {
        speak(getQuickReply(), 2000)
    }

    const azureOpenAIEndpoint = document.getElementById('azureOpenAIEndpoint').value
    const azureOpenAIApiKey = document.getElementById('azureOpenAIApiKey').value
    const azureOpenAIDeploymentName = document.getElementById('azureOpenAIDeploymentName').value

    let url = "{AOAIEndpoint}/openai/deployments/{AOAIDeployment}/chat/completions?api-version=2023-06-01-preview".replace("{AOAIEndpoint}", azureOpenAIEndpoint).replace("{AOAIDeployment}", azureOpenAIDeploymentName)
    let body = JSON.stringify({
        messages: messages,
        stream: true
    })

    if (dataSources.length > 0) {
        url = "{AOAIEndpoint}/openai/deployments/{AOAIDeployment}/extensions/chat/completions?api-version=2023-06-01-preview".replace("{AOAIEndpoint}", azureOpenAIEndpoint).replace("{AOAIDeployment}", azureOpenAIDeploymentName)
        body = JSON.stringify({
            dataSources: dataSources,
            messages: messages,
            stream: true
        })
    }

    let assistantReply = ''
    let toolContent = ''
    let spokenSentence = ''
    currentAssistantBubble = appendChatBubble('assistant', '', { raw: true })

    fetch(url, {
        method: 'POST',
        headers: {
            'api-key': azureOpenAIApiKey,
            'Content-Type': 'application/json'
        },
        body: body
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Chat API response status: ${response.status} ${response.statusText}`)
        }

        const assistantBubble = currentAssistantBubble || appendChatBubble('assistant', '', { raw: true })
        currentAssistantBubble = assistantBubble
        const reader = response.body.getReader()

        // Function to recursively read chunks from the stream
        function read(previousChunkString = '') {
            return reader.read().then(({ value, done }) => {
                // Check if there is still data to read
                if (done) {
                    // Stream complete
                    return
                }

                // Process the chunk of data (value)
                let chunkString = new TextDecoder().decode(value, { stream: true })
                if (previousChunkString !== '') {
                    // Concatenate the previous chunk string in case it is incomplete
                    chunkString = previousChunkString + chunkString
                }

                if (!chunkString.endsWith('}\n\n') && !chunkString.endsWith('[DONE]\n\n')) {
                    // This is a incomplete chunk, read the next chunk
                    return read(chunkString)
                }

                chunkString.split('\n\n').forEach((line) => {
                    try {
                        if (line.startsWith('data:') && !line.endsWith('[DONE]')) {
                            const responseJson = JSON.parse(line.substring(5).trim())
                            let responseToken = undefined
                            if (dataSources.length === 0) {
                                responseToken = responseJson.choices[0].delta.content
                            } else {
                                let role = responseJson.choices[0].messages[0].delta.role
                                if (role === 'tool') {
                                    toolContent = responseJson.choices[0].messages[0].delta.content
                                } else {
                                    responseToken = responseJson.choices[0].messages[0].delta.content
                                    if (responseToken !== undefined) {
                                        if (byodDocRegex.test(responseToken)) {
                                            responseToken = responseToken.replace(byodDocRegex, '').trim()
                                        }

                                        if (responseToken === '[DONE]') {
                                            responseToken = undefined
                                        }
                                    }
                                }
                            }

                            if (responseToken !== undefined && responseToken !== null) {
                                assistantReply += responseToken // build up the assistant message
                                if (!enableDisplayTextAlignmentWithSpeech) {
                                    appendRawTextToBubble(assistantBubble, responseToken)
                                }

                                // console.log(`Current token: ${responseToken}`)

                                if (responseToken === '\n' || responseToken === '\n\n') {
                                    spokenSentence += responseToken
                                    speak(spokenSentence)
                                    spokenSentence = ''
                                } else {
                                    spokenSentence += responseToken // build up the spoken sentence

                                    responseToken = responseToken.replace(/\n/g, '')
                                    if (responseToken.length === 1 || responseToken.length === 2) {
                                        for (let i = 0; i < sentenceLevelPunctuations.length; ++i) {
                                            let sentenceLevelPunctuation = sentenceLevelPunctuations[i]
                                            if (responseToken.startsWith(sentenceLevelPunctuation)) {
                                                speak(spokenSentence)
                                                spokenSentence = ''
                                                break
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.log(`Error occurred while parsing the response: ${error}`)
                        console.log(chunkString)
                    }
                })

                // Continue reading the next chunk
                return read()
            })
        }

        // Start reading the stream
        return read()
    })
    .then(() => {
        if (spokenSentence !== '') {
            speak(spokenSentence)
            spokenSentence = ''
        }

        if (dataSources.length > 0) {
            let toolMessage = {
                role: 'tool',
                content: toolContent
            }

            messages.push(toolMessage)
        }

        let assistantMessage = {
            role: 'assistant',
            content: assistantReply
        }

        messages.push(assistantMessage)
    })
}

function getQuickReply() {
    return quickReplies[Math.floor(Math.random() * quickReplies.length)]
}

function checkHung() {
    // Check whether the avatar video stream is hung, by checking whether the video time is advancing
    let videoElement = document.getElementById('videoPlayer')
    if (videoElement !== null && videoElement !== undefined && sessionActive) {
        let videoTime = videoElement.currentTime
        setTimeout(() => {
            // Check whether the video time is advancing
            if (videoElement.currentTime === videoTime) {
                // Check whether the session is active to avoid duplicatedly triggering reconnect
                if (sessionActive) {
                    sessionActive = false
                    if (document.getElementById('autoReconnectAvatar').checked) {
                        // No longer reconnect when there is no interaction for a while
                        if (new Date() - lastInteractionTime < 300000) {
                            console.log(`[${(new Date()).toISOString()}] The video stream got disconnected, need reconnect.`)
                            isReconnecting = true
                            // Remove data channel onmessage callback to avoid duplicatedly triggering reconnect
                            peerConnectionDataChannel.onmessage = null
                            // Release the existing avatar connection
                            if (avatarSynthesizer !== undefined) {
                                avatarSynthesizer.close()
                            }
    
                            // Setup a new avatar connection
                            connectAvatar()
                        }
                    }
                }
            }
        }, 2000)
    }
}

function checkLastSpeak() {
    if (lastSpeakTime === undefined) {
        return
    }

    let currentTime = new Date()
    if (currentTime - lastSpeakTime > 15000) {
        if (document.getElementById('useLocalVideoForIdle').checked && sessionActive && !isSpeaking) {
            disconnectAvatar()
            document.getElementById('localVideo').hidden = false
            document.getElementById('remoteVideo').style.display = 'none'
            sessionActive = false
        }
    }
}

window.onload = () => {
    initSettingsPersistence()
    updateChatHistoryPlaceholderVisibility()
    setInterval(() => {
        checkHung()
        checkLastSpeak()
    }, 2000) // Check session activity every 2 seconds
}

window.startSession = () => {
    lastInteractionTime = new Date()
    if (document.getElementById('useLocalVideoForIdle').checked) {
        document.getElementById('startSession').disabled = true
        document.getElementById('configuration').hidden = true
        document.getElementById('microphone').disabled = false
        document.getElementById('stopSession').disabled = false
        document.getElementById('localVideo').hidden = false
        document.getElementById('remoteVideo').style.display = 'none'
        document.getElementById('chatHistory').hidden = false
        document.getElementById('showTypeMessage').disabled = false
        updateChatHistoryPlaceholderVisibility()
        return
    }

    document.getElementById('remoteVideo').style.display = ''
    userClosedSession = false
    connectAvatar()
}

window.stopSession = () => {
    lastInteractionTime = new Date()
    document.getElementById('startSession').disabled = false
    document.getElementById('microphone').disabled = true
    document.getElementById('stopSession').disabled = true
    document.getElementById('configuration').hidden = false
    document.getElementById('chatHistory').hidden = true
    updateChatHistoryPlaceholderVisibility()
    document.getElementById('remoteVideo').style.display = 'none'
    document.getElementById('showTypeMessage').checked = false
    document.getElementById('showTypeMessage').disabled = true
    document.getElementById('userMessageBox').hidden = true
    document.getElementById('uploadImgIcon').hidden = true
    if (document.getElementById('useLocalVideoForIdle').checked) {
        document.getElementById('localVideo').hidden = true
    }

    userClosedSession = true
    disconnectAvatar()
}

window.clearChatHistory = () => {
    lastInteractionTime = new Date()
    clearChatHistoryUI()
    initMessages()
}

window.microphone = () => {
    lastInteractionTime = new Date()
    logDiagnostic('MicrophoneControl', 'ToggleInvoked', {
        buttonLabel: document.getElementById('microphone').innerHTML,
        sessionActive
    })
    if (document.getElementById('microphone').innerHTML === 'Stop Microphone') {
        // Stop microphone
        document.getElementById('microphone').disabled = true
        speechRecognizer.stopContinuousRecognitionAsync(
            () => {
                document.getElementById('microphone').innerHTML = 'Start Microphone'
                document.getElementById('microphone').disabled = false
                logDiagnostic('MicrophoneControl', 'StopRecognitionSucceeded')
            }, (err) => {
                logDiagnostic('MicrophoneControl', 'StopRecognitionFailed', {
                    message: err && err.message ? err.message : err,
                    stack: err && err.stack ? err.stack : undefined
                })
                document.getElementById('microphone').disabled = false
            })

        return
    }

    if (document.getElementById('useLocalVideoForIdle').checked) {
        if (!sessionActive) {
            connectAvatar()
        }

        setTimeout(() => {
            document.getElementById('audioPlayer').play()
        }, 5000)
    } else {
        document.getElementById('audioPlayer').play()
    }

    document.getElementById('microphone').disabled = true
    logDiagnostic('MicrophoneControl', 'StartRecognitionRequested')
    speechRecognizer.recognized = async (s, e) => {
        logDiagnostic('SpeechRecognizer', 'RecognizedEvent', {
            sessionId: e.sessionId,
            reason: e.result.reason,
            text: e.result && e.result.text ? e.result.text : '',
            offset: e.result && typeof e.result.offset === 'number' ? e.result.offset : undefined
        })
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            let userQuery = e.result.text.trim()
            if (userQuery === '') {
                return
            }

            // Auto stop microphone when a phrase is recognized, when it's not continuous conversation mode
            if (!document.getElementById('continuousConversation').checked) {
                document.getElementById('microphone').disabled = true
                speechRecognizer.stopContinuousRecognitionAsync(
                    () => {
                        document.getElementById('microphone').innerHTML = 'Start Microphone'
                        document.getElementById('microphone').disabled = false
                    }, (err) => {
                        console.log("Failed to stop continuous recognition:", err)
                        document.getElementById('microphone').disabled = false
                    })
            }

            handleUserQuery(userQuery,"","")
        }
    }

    speechRecognizer.startContinuousRecognitionAsync(
        () => {
            document.getElementById('microphone').innerHTML = 'Stop Microphone'
            document.getElementById('microphone').disabled = false
            logDiagnostic('MicrophoneControl', 'StartRecognitionSucceeded')
        }, (err) => {
            logDiagnostic('MicrophoneControl', 'StartRecognitionFailed', {
                message: err && err.message ? err.message : err,
                stack: err && err.stack ? err.stack : undefined
            })
            document.getElementById('microphone').disabled = false
        })
}

window.updataEnableOyd = () => {
    if (document.getElementById('enableOyd').checked) {
        document.getElementById('cogSearchConfig').hidden = false
    } else {
        document.getElementById('cogSearchConfig').hidden = true
    }
}

window.updateTypeMessageBox = () => {
    if (document.getElementById('showTypeMessage').checked) {
        document.getElementById('userMessageBox').hidden = false
        document.getElementById('uploadImgIcon').hidden = false
        document.getElementById('userMessageBox').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const userQuery = document.getElementById('userMessageBox').innerText
                const messageBox = document.getElementById('userMessageBox')
                const childImg = messageBox.querySelector("#picInput")
                if (childImg) {
                    childImg.style.width = "200px"
                    childImg.style.height = "200px"
                }
                let userQueryHTML = messageBox.innerHTML.trim("")
                if(userQueryHTML.startsWith('<img')){
                    userQueryHTML="<br/>"+userQueryHTML
                }
                if (userQuery !== '') {
                    handleUserQuery(userQuery.trim(''), userQueryHTML, imgUrl)
                    document.getElementById('userMessageBox').innerHTML = ''
                    imgUrl = ""
                }
            }
        })
        document.getElementById('uploadImgIcon').addEventListener('click', function() {
            imgUrl = "https://wallpaperaccess.com/full/528436.jpg"
            const userMessage = document.getElementById("userMessageBox");
            const childImg = userMessage.querySelector("#picInput");
            if (childImg) {
                userMessage.removeChild(childImg)
            }
            userMessage.innerHTML+='<br/><img id="picInput" src="https://wallpaperaccess.com/full/528436.jpg" style="width:100px;height:100px"/><br/><br/>'   
        });
    } else {
        document.getElementById('userMessageBox').hidden = true
        document.getElementById('uploadImgIcon').hidden = true
        imgUrl = ""
    }
}

window.updateLocalVideoForIdle = () => {
    if (document.getElementById('useLocalVideoForIdle').checked) {
        document.getElementById('showTypeMessageCheckbox').hidden = true
        document.getElementById('remoteVideo').style.display = 'none'
    } else {
        document.getElementById('showTypeMessageCheckbox').hidden = false
        document.getElementById('remoteVideo').style.display = ''
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
    if (document.getElementById('photoAvatar').checked) {
        document.getElementById('talkingAvatarCharacter').value = 'anika'
        document.getElementById('talkingAvatarStyle').value = ''
    } else {
        document.getElementById('talkingAvatarCharacter').value = 'lisa'
        document.getElementById('talkingAvatarStyle').value = 'casual-sitting'
    }
    persistSettingValueById('talkingAvatarCharacter')
    persistSettingValueById('talkingAvatarStyle')
}

window.updateCustomAvatarBox = () => {
    if (document.getElementById('customizedAvatar').checked) {
        document.getElementById('useBuiltInVoice').disabled = false
    } else {
        document.getElementById('useBuiltInVoice').disabled = true
        document.getElementById('useBuiltInVoice').checked = false
    }
    persistSettingValueById('useBuiltInVoice')
}