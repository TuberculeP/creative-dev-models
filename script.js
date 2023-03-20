import DeviceDetector from "https://cdn.skypack.dev/device-detector-js@2.2.10";
testSupport([{ client: 'Chrome' }]);
function testSupport(supportedDevices) {
    const deviceDetector = new DeviceDetector();
    const detectedDevice = deviceDetector.parse(navigator.userAgent);
    let isSupported = false;
    for (const device of supportedDevices) {
        if (device.client !== undefined) {
            const re = new RegExp(`^${device.client}$`);
            if (!re.test(detectedDevice.client.name)) {
                continue;
            }
        }
        if (device.os !== undefined) {
            const re = new RegExp(`^${device.os}$`);
            if (!re.test(detectedDevice.os.name)) {
                continue;
            }
        }
        isSupported = true;
        break;
    }
    if (!isSupported) {
        alert(`This demo, running on ${detectedDevice.client.name}/${detectedDevice.os.name}, ` +
            `is not well supported at this time, continue at your own risk.`);
    }
}

const controls = window;


const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const controlsElement = document.querySelector('.control-panel.segmentation');

const canvasCtx = canvasElement.getContext('2d');

const spinner = document.querySelector('.loading');
spinner.ontransitionend = () => {
    spinner.style.display = 'none';
};


const captureButton = document.querySelector('#capture');
captureButton.addEventListener('click', () => {
    captureButton.style.display = 'none';
    html2canvas(document.body).then(canvas => {
        canvas.toBlob(function(blob) {
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = 'image.png';
            a.click();
        });
        captureButton.style.display = 'block';
    });
});


function onSegmentationResults(results) {
    // Hide the spinner.
    document.body.classList.add('loaded');
    // Update the frame rate.
    // Draw the overlays.
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
    // Only overwrite existing pixels.
    if (activeEffect === 'mask' || activeEffect === 'both') {
        canvasCtx.globalCompositeOperation = 'source-in';
        // This can be a color or a texture or whatever...
        canvasCtx.fillStyle = 'black';
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }
    else {
        canvasCtx.globalCompositeOperation = 'source-out';
        canvasCtx.fillStyle = 'black';
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }
    // Only overwrite missing pixels.
    canvasCtx.globalCompositeOperation = 'destination-atop';
    canvasCtx.fillStyle = 'white';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore();
}

const selfieSegmentation = new SelfieSegmentation({ locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`;
    } });
selfieSegmentation.onResults(onSegmentationResults);


// AJOUTS POUR FACE MESH
const drawingUtils = window;
const mpFaceMesh = window;
const config = { locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@` +
            `${mpFaceMesh.VERSION}/${file}`;
    } };
const solutionOptions = {
    selfieMode: true,
    enableFaceGeometry: false,
    maxNumFaces: 4,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
};

function onFaceMeshResults(results) {
    document.body.classList.add('loaded');
    canvasCtx.save();
    //canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    //canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
            drawConnectors(canvasCtx, landmarks, mpFaceMesh.FACEMESH_RIGHT_IRIS, {color: 'black', lineWidth: 50});
            drawConnectors(canvasCtx, landmarks, mpFaceMesh.FACEMESH_LEFT_IRIS, {color: 'black', lineWidth: 50});
        }
    }
    canvasCtx.restore();
}
const faceMesh = new mpFaceMesh.FaceMesh(config);
faceMesh.setOptions(solutionOptions);
faceMesh.onResults(onFaceMeshResults);
// Present a control panel through which the user can manipulate the solution
// options.



//CONTROLS SEGMENTATION
let activeEffect = 'mask';
new controls
    .ControlPanel(controlsElement, {
    selfieMode: true,
    modelSelection: 0,
    effect: 'background',
})
    .add([
    new controls.SourcePicker({
        onSourceChanged: () => {
            selfieSegmentation.reset();
        },
        onFrame: async (input, size) => {
            const aspect = size.height / size.width;
            let width, height;
            if (window.innerWidth > window.innerHeight) {
                height = window.innerHeight;
                width = height / aspect;
            }
            else {
                width = window.innerWidth;
                height = width * aspect;
            }
            canvasElement.width = width;
            canvasElement.height = height;
            await selfieSegmentation.send({ image: input });
            await faceMesh.send({ image: input });

        },
    }),
])
    .on(x => {
    const options = x;
    videoElement.classList.toggle('selfie', options.selfieMode);
    activeEffect = x['effect'];
    selfieSegmentation.setOptions(options);
    faceMesh.setOptions(options);
});