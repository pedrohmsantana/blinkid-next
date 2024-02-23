"use client";
import { useEffect } from "react";
import * as BlinkIDSDK from "@microblink/blinkid-in-browser-sdk";

export default function Home() {
  useEffect(() => {
    const initialMessageEl = document.getElementById(
      "msg"
    ) as HTMLHeadingElement;
    const progressEl = document.getElementById(
      "load-progress"
    ) as HTMLProgressElement;
    const cameraFeed = document.getElementById(
      "camera-feed"
    ) as HTMLVideoElement;
    const scanFeedback = document.getElementById(
      "camera-guides"
    ) as HTMLParagraphElement;
    if (!BlinkIDSDK.isBrowserSupported()) {
      initialMessageEl.innerText = "This browser is not supported!";
      return;
    }
    const licenseKey = process.env.NEXT_PUBLIC_BLINKID_LICENSE_KEY || "";

    // 2. Create instance of SDK load settings with your license key
    const loadSettings = new BlinkIDSDK.WasmSDKLoadSettings(licenseKey);

    // [OPTIONAL] Change default settings

    // Show or hide hello message in browser console when WASM is successfully loaded
    loadSettings.allowHelloMessage = true;

    // In order to provide better UX, display progress bar while loading the SDK
    loadSettings.loadProgressCallback = (progress: number) =>
      (progressEl!.value = progress);

    // Set absolute location of the engine, i.e. WASM and support JS files
    loadSettings.engineLocation = window.location.origin + "/resources";

    // Set absolute location of the worker file
    loadSettings.workerLocation =
      window.location.origin + "/resources/BlinkIDWasmSDK.worker.min.js";

    // 3. Load SDK
    BlinkIDSDK.loadWasmModule(loadSettings).then(
      (sdk: BlinkIDSDK.WasmSDK) => {
        document.getElementById("screen-initial")?.classList.add("hidden");
        document.getElementById("screen-start")?.classList.remove("hidden");
        document
          .getElementById("start-scan")
          ?.addEventListener("click", (ev: any) => {
            ev.preventDefault();
            startScan(sdk);
          });
      },
      (error: any) => {
        initialMessageEl.innerText = "Failed to load SDK!";
        console.error("Failed to load SDK!", error);
      }
    );

    async function startScan(sdk: BlinkIDSDK.WasmSDK) {
      document.getElementById("screen-start")?.classList.add("hidden");
      document.getElementById("screen-scanning")?.classList.remove("hidden");

      // 1. Create a recognizer objects which will be used to recognize single image or stream of images.
      //
      const multiSideIDRecognizer =
        await BlinkIDSDK.createBlinkIdMultiSideRecognizer(sdk);

      // [OPTIONAL] Create a callbacks object that will receive recognition events, such as detected object location etc.

      // 2. Create a RecognizerRunner object which orchestrates the recognition with one or more

      //    recognizer objects.
      const recognizerRunner = await BlinkIDSDK.createRecognizerRunner(
        // SDK instance to use
        sdk,

        // List of recognizer objects that will be associated with created RecognizerRunner object
        [multiSideIDRecognizer],

        // [OPTIONAL] Should recognition pipeline stop as soon as first recognizer in chain finished recognition
        false
      );

      // 3. Create a VideoRecognizer object and attach it to HTMLVideoElement that will be used for displaying the camera feed
      const videoRecognizer =
        await BlinkIDSDK.VideoRecognizer.createVideoRecognizerFromCameraStream(
          cameraFeed,
          recognizerRunner,
          undefined,
          BlinkIDSDK.PreferredCameraType.FrontFacingCamera
        );

      // 4. Start the recognition and await for the results

      const processResult = await videoRecognizer.recognize();

      // 5. If recognition was successful, obtain the result and display it
      if (processResult !== BlinkIDSDK.RecognizerResultState.Empty) {
        const singleSideIDResults = await multiSideIDRecognizer.getResult();
        if (
          singleSideIDResults.state !== BlinkIDSDK.RecognizerResultState.Empty
        ) {
          console.log(
            "BlinkID Single-side recognizer results",
            singleSideIDResults
          );
          const firstName =
            singleSideIDResults.firstName.latin ||
            singleSideIDResults.firstName.cyrillic ||
            singleSideIDResults.firstName.arabic ||
            singleSideIDResults.mrz.secondaryID;
          const lastName =
            singleSideIDResults.lastName.latin ||
            singleSideIDResults.lastName.cyrillic ||
            singleSideIDResults.lastName.arabic ||
            singleSideIDResults.mrz.primaryID;
          const fullName =
            singleSideIDResults.fullName.latin ||
            singleSideIDResults.fullName.cyrillic ||
            singleSideIDResults.fullName.arabic ||
            `${singleSideIDResults.mrz.secondaryID} ${singleSideIDResults.mrz.primaryID}`;
          const dateOfBirth = {
            year:
              singleSideIDResults.dateOfBirth.year ||
              singleSideIDResults.mrz.dateOfBirth.year,
            month:
              singleSideIDResults.dateOfBirth.month ||
              singleSideIDResults.mrz.dateOfBirth.month,
            day:
              singleSideIDResults.dateOfBirth.day ||
              singleSideIDResults.mrz.dateOfBirth.day,
          };
          const derivedFullName = `${firstName} ${lastName}`.trim() || fullName;
          alert(
            `Hello, ${derivedFullName}!\n You were born on ${dateOfBirth.year}-${dateOfBirth.month}-${dateOfBirth.day}.`
          );
        }
      } else {
        alert("Could not extract information!");
      }

      // // 7. Release all resources allocated on the WebAssembly heap and associated with camera stream

      // // Release browser resources associated with the camera stream
      videoRecognizer?.releaseVideoFeed();

      // Release memory on WebAssembly heap used by the RecognizerRunner
      recognizerRunner?.delete();

      // Release memory on WebAssembly heap used by the recognizer
      multiSideIDRecognizer?.delete();

      // Hide scanning screen and show scan button again
      document.getElementById("screen-start")?.classList.remove("hidden");
      document.getElementById("screen-scanning")?.classList.add("hidden");
    }
  }, []);
  return (
    <>
      <div id="screen-initial">
        <h1 id="msg">Loading...</h1>
        <progress id="load-progress" value="0" max="100"></progress>
      </div>
      <div id="screen-start" className="hidden">
        <a href="#" id="start-scan">
          Start scan
        </a>
      </div>
      <div id="screen-scanning" className="hidden">
        <video id="camera-feed" playsInline className="w-full h-screen"></video>
      </div>
    </>
  );
}
