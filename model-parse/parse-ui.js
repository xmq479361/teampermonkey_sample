// ==UserScript==
// @name         parse-ui.js
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  UI components for multi-source HTML to Dart Parser
// @match        https://*
// @grant        GM_setClipboard
// @grant        GM_getClipboard
// @grant        GM_addStyle
// @require      https://raw.githubusercontent.com/xmq479361/teampermonkey_sample/refs/heads/main/model-parse/parse-model-core.js?t=6
// @require      https://raw.githubusercontent.com/xmq479361/teampermonkey_sample/refs/heads/main/model-parse/parse-dart-generator.js?t=6
// ==/UserScript==

(function () {
  "use strict";

  const currentDomain = window.location.hostname;
  console.log("currentDomain:", currentDomain);
  const isTornaSite = currentDomain.includes("torna.tclpv.com");
  const isApifoxSite = currentDomain.includes("apifox.com");
  GM_addStyle(`
      .generate-button {
          position: fixed;
          right: 20px;
          z-index: 1000;
          padding: 5px 10px;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 15px;
          cursor: pointer;
          margin-bottom: 10px;
      }
      .parser-button {
          position: fixed;
          right: 20px;
          z-index: 1000;
          padding: 5px 10px;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 15px;
          cursor: pointer;
          margin-bottom: 10px;
      }
      .parser-toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 10px 20px;
          border-radius: 5px;
          z-index: 10000;
      }
  `);

  function showToast(message, duration = 3000) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.className = "parser-toast";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  function promptForModelName() {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: rgba(0, 0, 0, 0.5);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 10001;
          `;

      const content = document.createElement("div");
      content.style.cssText = `
              background-color: white;
              padding: 20px;
              border-radius: 5px;
          `;

      const input = document.createElement("input");
      input.type = "text";
      input.value = "ResponseModel";
      input.placeholder = "Enter class name";
      input.style.cssText = `
              margin-bottom: 10px;
              width: 100%;
              padding: 5px;
          `;

      const submitButton = document.createElement("button");
      submitButton.textContent = "Submit";
      submitButton.style.marginRight = "10px";

      const cancelButton = document.createElement("button");
      cancelButton.textContent = "Cancel";

      content.appendChild(input);
      content.appendChild(submitButton);
      content.appendChild(cancelButton);
      modal.appendChild(content);

      submitButton.addEventListener("click", () => {
        const modelName = input.value.trim();
        if (modelName) {
          modal.remove();
          resolve(modelName);
        } else {
          showToast("Please enter a model name");
        }
      });

      cancelButton.addEventListener("click", () => {
        modal.remove();
        resolve(null);
      });

      document.body.appendChild(modal);
      input.focus();
    });
  }

  function addParseButton(text, top, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.className = "parser-button";
    button.style.top = top;
    button.style.backgroundColor = "#007BFF";
    button.style.color = "white";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    button.style.padding = "10px 15px";
    button.style.cursor = "pointer";
    button.addEventListener("click", onClick);
    document.body.appendChild(button);
  }

  function addGenerateButton(text, top, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.className = "generate-button";
    button.style.top = top;
    button.style.backgroundColor = "#28A745";
    button.style.color = "white";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    button.style.padding = "10px 15px";
    button.style.cursor = "pointer";
    button.addEventListener("click", onClick);
    document.body.appendChild(button);
  }

  let classMap = new Map();
  function updateButtonState() {
    const isEnabled = classMap.size > 0;
    // document.querySelectorAll(".parser-button").forEach((button) => {
    //   button.disabled = !isEnabled;
    //   button.style.opacity = isEnabled ? "1" : "0.5";
    //   button.style.cursor = isEnabled ? "pointer" : "not-allowed";
    // });
    document.querySelectorAll(".generate-button").forEach((button) => {
      button.disabled = !isEnabled;
      button.style.opacity = isEnabled ? "1" : "0.5";
      button.style.cursor = isEnabled ? "pointer" : "not-allowed";
    });
  }

  // Add UI buttons
  addGenerateButton("Generate Dart", "40vh", async () => {
    try {
      if (classMap.size > 0) {
        const generatedCode = window.dartGenerator.generateDartCode(classMap);
        const formattedCode =
          window.dartGenerator.formatDartCode(generatedCode);
        GM_setClipboard(formattedCode);
        showToast("Dart model generated and copied to clipboard!");
      } else {
        showToast("No valid data found. Please parse data first.");
      }
    } catch (error) {
      console.error(error);
      showToast("An error occurred while generating Dart model.");
    }
  });

  addGenerateButton('Generate Dart (with "as")', "35vh", async () => {
    try {
      if (classMap.size > 0) {
        const generatedCode = window.dartGenerator.generateDartCode(
          classMap,
          true
        );
        const formattedCode =
          window.dartGenerator.formatDartCode(generatedCode);
        console.log(formattedCode);
        GM_setClipboard(formattedCode);
        showToast(
          'Dart model (with "as" syntax) generated and copied to clipboard!'
        );
      } else {
        showToast("No valid data found. Please parse data first.");
      }
    } catch (error) {
      console.error(error);
      showToast("An error occurred while generating Dart model.");
    }
  });

  // Add site-specific buttons
  if (isTornaSite) {
    addParseButton("Parse Torna Response", "30vh", () => {
      const parser = window.parser.createParser("torna");
      const { rootModel, classMap: parsedClassMap } = parser.parse(
        document.body.innerHTML
      );
      classMap = parsedClassMap;
      updateButtonState();
      showToast("Data parsed successfully!");
    });
  } else if (isApifoxSite) {
    addParseButton("Parse Apifox Response", "30vh", () => {
      const parser = window.parser.createParser("apifox");
      // Implement Apifox-specific parsing logic here
      showToast("Apifox parsing not yet implemented");
    });
  }

  // Add clipboard parsing buttons
  addParseButton("Parse JSON from Clipboard", "25vh", async () => {
    let clipboardText;
    if (navigator.clipboard && navigator.clipboard.readText) {
      clipboardText = await navigator.clipboard.readText();
    } else if (typeof GM_getClipboard === "function") {
      clipboardText = await GM_getClipboard();
    } else {
      showToast("No clipboard access method is available.");
      return;
    }
    if (!clipboardText) {
      showToast("No JSON data found in clipboard!");
      return;
    }
    const parser = window.parser.createParser("json");
    const { rootModel, classMap: parsedClassMap } = parser.parse(clipboardText);
    classMap = parsedClassMap;
    updateButtonState();
    showToast("Data parsed successfully!");
  });

  addParseButton("Parse Dart from Clipboard", "20vh", async () => {
    let clipboardText;
    if (navigator.clipboard && navigator.clipboard.readText) {
      clipboardText = await navigator.clipboard.readText();
    } else if (typeof GM_getClipboard === "function") {
      clipboardText = await GM_getClipboard();
    } else {
      showToast("No clipboard access method is available.");
      return;
    }
    if (!clipboardText) {
      showToast("No Dart class found in clipboard!");
      return;
    }
    const parser = window.parser.createParser("dart");
    const { rootModel, classMap: parsedClassMap } = parser.parse(clipboardText);
    classMap = parsedClassMap;
    updateButtonState();
    showToast("Data parsed successfully!");
  });
  updateButtonState();
})();

console.log("UI components added to the page");
