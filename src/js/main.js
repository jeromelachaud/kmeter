var meter = null;
var intervalId = null;
var volumesRecorded = [];
var recordDuration = 1000 * 5;
var numberOfMeasures = 50;
var intervalValue = Math.round(recordDuration / numberOfMeasures);
var countdown = 5;
var countdownIntervalId = null;
var gaugeMin = 0;
var gaugeMax = 100;
var gauge = null;
var feedBackButtonTxt = 'Feedback';
var mainNumber = document.getElementById('mainNumber');

function createLoudMeter(options) {
  var time = options.countdownTime || 5;
  initializeAudio(onAudioMeasureStart, onAudioMeasureIteration, onAudioMeasureEnd, didntGetStream);
  gauge = new JustGage({
    id: "meter",
    value: 0,
    min: 0,
    max: 100,
    hideValue: true,
    title: "",
    gaugeColor: '#f4f4f4',
    gaugeWidthScale: 0.7,
    levelColors: [
      "#fa4133",
      "#fdbe37",
      "#1cb42f"
    ]
  });
}

function getUserMediaProperties() {
  return {
    'audio': {
      'mandatory': {
        'googEchoCancellation': 'false',
        'googAutoGainControl': 'false',
        'googNoiseSuppression': 'false',
        'googHighpassFilter': 'false'
      },
      'optional': []
    }
  };
}

function getUserMediaFunction() {
  return navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
}

function requestUserAudioPermission(onAudioMeasureStart, onError) {
  try {
    // monkeypatch getUserMedia
    navigator.getUserMedia = getUserMediaFunction();
    navigator.getUserMedia(getUserMediaProperties(), onAudioMeasureStart, onError);
  } catch (e) {
      alert('getUserMedia threw exception :' + e);
  }
}

function getAudioContext() {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  return new AudioContext();
}

function initializeAudio(onAudioMeasureStart, onAudioMeasureEnd, onError) {
  requestUserAudioPermission(onAudioMeasureStart, onAudioMeasureEnd, onError);
}

function didntGetStream() {
  alert('Stream generation failed.');
}

function onAudioMeasureStart(stream) {
  var audioContext = getAudioContext();
  var mediaStreamSource = audioContext.createMediaStreamSource(stream);

  // Create a new volume meter and connect it.
  meter = createAudioMeter(audioContext, 0.999);
  mediaStreamSource.connect(meter);

  listenToInput(onAudioMeasureIteration, onAudioMeasureEnd);
  startCountdown(5, mainNumber);
}

function listenToInput(onAudioMeasureIteration, onAudioMeasureEnd) {
  if (volumesRecorded.length >= numberOfMeasures) {
    return;
  }
  var volume = meter.volume * 1.4 * 500;
  onAudioMeasureIteration(volume);
  volumesRecorded.push(volume);

  if (volumesRecorded.length >= numberOfMeasures) {
    var averageVolumeRounded = getAverageVolume(volumesRecorded);
    onAudioMeasureEnd(averageVolumeRounded);
  }
  if (intervalId) {
    clearInterval(intervalId);
  }
  intervalId = setInterval(function() {
    listenToInput(onAudioMeasureIteration, onAudioMeasureEnd);
  }, intervalValue);
}

function getAverageVolume(volumesRecorded) {
  var volumeSum = volumesRecorded.reduce(function(previous, next) {
    return previous + next;
  });
  var averageVolumeRounded = Math.round(volumeSum / volumesRecorded.length);
  console.log(volumesRecorded);
  console.log(volumeSum);
  console.log(volumesRecorded.length);
  console.log(averageVolumeRounded);
  return averageVolumeRounded;
}

function onAudioMeasureIteration(volume) {
  setGaugeValue(volume);
}

function onAudioMeasureEnd(volume) {
  setGaugeValue(volume);
  setFinalEmoji(volume);
  displayFinalVolume(volume)
  displayFeedbackButton();
}

function setFinalEmoji(volume) {
  var thirdPart = (gaugeMax - gaugeMin) / 3;
  var resultMessage;

  if (volume === gaugeMin) {
    resultMessage = '';
  } else if (volume < gaugeMin + thirdPart ) {
    resultMessage = getResultMessageHtml('Better luck next time', 'img/1.png');
  } else if (volume >= (gaugeMin + thirdPart) && volume < (gaugeMin + 2*thirdPart) ) {
    resultMessage = getResultMessageHtml('Wow, super-kahoot!er', 'img/2.png');
  } else if (volume >= (gaugeMin + 2*thirdPart) ) {
    resultMessage = getResultMessageHtml('Awesome unlocked!', 'img/3.png');
  }
  document.getElementById('feedbackMsg').innerHTML = resultMessage;
}

function displayFinalVolume(volume) {
  mainNumber.innerHTML = volume;
  mainNumber.className += ' final-volume animated bounceIn';
}

function getResultMessageHtml(message, image) {
  return [
    '<div class="feedback-message">',
    message,
    '</div>',
    '<img src="' + image + '"/>'
  ].join('');
}

function displayFeedbackButton() {
  var feedbackButton = document.getElementById('feedbackButton')
  feedbackButton.style.visibility = 'visible';
  feedbackButton.innerHTML = feedBackButtonTxt
}

function setGaugeValue(volume) {
  gauge.refresh(volume);
}

function createAudioMeter(audioContext, clipLevel, averaging, clipLag) {
  var processor = audioContext.createScriptProcessor(512);
  processor.onaudioprocess = volumeAudioProcess;
  processor.clipping = false;
  processor.lastClip = 0;
  processor.volume = 0;
  processor.clipLevel = clipLevel || 0.98;
  processor.averaging = averaging || 0.95;
  processor.clipLag = clipLag || 750;

  // Workaround a Chrome bug
  processor.connect(audioContext.destination);
  return processor;
}

function volumeAudioProcess( event ) {
  var buf = event.inputBuffer.getChannelData(0);
  var bufLength = buf.length;
  var sum = 0;
  var x;

	// Do a root-mean-square on the samples: sum up the squares...
  for (var i=0; i<bufLength; i++) {
    x = buf[i];
    if (Math.abs(x)>=this.clipLevel) {
      this.clipping = true;
      this.lastClip = window.performance.now();
    }
    sum += x * x;
  }
    // ... then take the square root of the sum.
    var rms =  Math.sqrt(sum / bufLength);

    // Now smooth this out with the averaging factor applied
    // to the previous sample - take the max here because we
    // want "fast attack, slow release."
    this.volume = Math.max(rms, this.volume*this.averaging);
}

function tick(element) {
  if (countdown > 0) {
    element.innerHTML = countdown;
    countdown--;
  } else {
    clearInterval(countdownIntervalId);
    element.innerHTML = '';
    return;
  }
}

function startCountdown(time, element) {
  tick(element);
  countdownIntervalId = setInterval(function () {
    tick(element);
  }, 1000);
}
