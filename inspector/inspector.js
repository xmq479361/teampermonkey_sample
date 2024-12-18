// ==UserScript==
// @name         inject-inspector.js
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Inspect and interact with HTML elements on demand
// @author       Your Name
// @match        *://*/*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  "use strict";

  let isActive = false;
  let popupElement = null;
  let selectedElement = null;
  let hoverTimeout = null;
  const whitelist = {
    class: ["element-highlight", "activate-inspector"],
    target: ["_blank", ""],
  };
  // 过滤属性
  function removeBlackAttr(attrName, value) {
    const rule = whitelist[attrName]; // 获取白名单规则
    // 如果规则为 "*"，返回空字符串（代表此属性完全允许）
    const oldValue = value;
    if (rule === "*") return "";
    // 如果规则是数组，则移除规则中匹配的值
    if (Array.isArray(rule)) {
      rule.forEach((item) => {
        value = value.replace(new RegExp(`\\b${item}\\b`, "g"), ""); // 使用正则匹配精确词
      });
    }
    console.log(`${oldValue} => ${value.trim()}`);
    return { name: attrName, value: value.trim() }; // 去除可能存在的多余空格
  }
  // 添加样式
  GM_addStyle(`
          .element-highlight {
              outline: 2px solid red !important;
          }
          .info-popup {
              position: absolute;
              z-index: 9999;
              padding: 15px;
              border: 1px solid #ccc;
              background: #fff;
              box-shadow: 0 4px 8px rgba(0,0,0,0.2);
              border-radius: 10px;
              max-width: 400px;
              font-size: 14px;
              color: #333;
              overflow: hidden;
              word-wrap: break-word;
              line-height: 1.5;
          }
          .info-popup h4 {
              margin-top: 0;
          }
          .info-popup .close-btn {
              position: absolute;
              top: 5px;
              right: 10px;
              cursor: pointer;
              color: red;
              font-weight: bold;
          }
          .info-popup .copyable {
              display: inline-block;
              padding: 5px 10px;
              margin: 5px 5px 0 0;
              background: #007BFF;
              color: #fff;
              border-radius: 5px;
              font-size: 12px;
              cursor: pointer;
          }
          .info-popup .copyable:hover {
              background: #0056b3;
          }
          .info-popup .css-selector {
              margin: 10px 0;
              padding: 5px;
              background: #007BFF; /* 统一背景颜色 */
              font-family: monospace;
              border-radius: 5px;
          }
          .parser-toast {
              position: fixed;
              bottom: 20px;
              left: 50%;
              transform: translateX(-50%);
              background: #333;
              color: #fff;
              padding: 10px 20px;
              border-radius: 5px;
              z-index: 9999;
              font-size: 14px;
              animation: fadein 0.5s, fadeout 0.5s 2.5s;
          }
          @keyframes fadein {
              from {opacity: 0;}
              to {opacity: 1;}
          }
          @keyframes fadeout {
              from {opacity: 1;}
              to {opacity: 0;}
          }
          .activate-inspector {
              position: fixed;
              top: 20px;
              right: 20px;
              z-index: 9999;
              background: #007BFF;
              color: #fff;
              border: none;
              border-radius: 25px;
              padding: 10px 15px;
              cursor: pointer;
              font-size: 14px;
          }
          .activate-inspector:hover {
              background: #de308a;
          }
      `);

  // 显示 Toast 提示
  function showToast(message, duration = 3000) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.className = "parser-toast";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  // 初始化激活按钮
  const activateButton = document.createElement("button");
  activateButton.textContent = "Hk";
  activateButton.className = "activate-inspector";
  document.body.appendChild(activateButton);

  activateButton.addEventListener("click", () => {
    isActive = !isActive;
    activateButton.textContent = isActive ? "-X-" : "Hk";
    if (!isActive) {
      activateButton.style.backgroundColor = "#007BFF";
      removeHighlight();
      if (popupElement) {
        popupElement.remove();
        popupElement = null;
      }
    } else {
      activateButton.style.backgroundColor = "#de308a";
    }
  });

  // 鼠标悬停处理
  document.addEventListener("mouseover", (event) => {
    if (!isActive) return;
    const target = event.target;

    if (popupElement && popupElement.contains(target)) {
      return; // 防止弹窗被高亮
    }

    removeHighlight();
    target.classList.add("element-highlight");

    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      showInfoPopup(target, event.pageX, event.pageY);
    }, 1000);
  });

  // 鼠标点击处理
  document.addEventListener("click", (event) => {
    if (!isActive) return;
    event.preventDefault();
    event.stopPropagation();

    const target = event.target;

    if (popupElement && popupElement.contains(target)) {
      return; // 点击弹窗不重新显示
    }

    selectedElement = target;
    removeHighlight();
    target.classList.add("element-highlight");
    showInfoPopup(target, event.pageX, event.pageY);
  });

  // 移除高亮
  function removeHighlight() {
    const highlighted = document.querySelector(".element-highlight");
    if (highlighted) {
      highlighted.classList.remove("element-highlight");
    }
  }

  // 显示信息弹窗
  function showInfoPopup(element, x, y) {
    if (popupElement) {
      popupElement.remove();
    }

    popupElement = document.createElement("div");
    popupElement.className = "info-popup";
    const attributes = Array.from(element.attributes)
      .map((attr) => removeBlackAttr(attr.name, attr.value))
      .filter((attr) => attr.value !== "")
      .map((attr) =>
        attr.name === "class"
          ? splitClassValues(attr.value)
          : `<div>${attr.name}: <span class="copyable" data-copy="${attr.value}">${attr.value}</span> </div>`
      )
      .join("");

    const cssSelector = getCssSelector(element);

    popupElement.innerHTML = `
              <div class="close-btn">✖</div>
              <h4>Element Info</h4>
              <p><strong>CSS Selector:</strong><br><span class="css-selector copyable" data-copy="${cssSelector}">${cssSelector}</span></p>
              <p><strong>Attributes:</strong><br>${attributes || "None"}</p>
          `;

    document.body.appendChild(popupElement);

    // 关闭按钮
    popupElement.querySelector(".close-btn").addEventListener("click", () => {
      popupElement.remove();
      popupElement = null;
    });

    // 复制功能
    popupElement.querySelectorAll(".copyable").forEach((item) => {
      item.addEventListener("click", () => {
        copyToClipboard(item.dataset.copy);
        showToast(`Copied: ${item.dataset.copy}`);
      });
    });

    positionPopup(popupElement, x, y);
  }
  function positionPopup(popup, x, y) {
    const { innerWidth, innerHeight } = window;
    const { scrollX, scrollY } = window; // 获取页面滚动位置
    const rect = popup.getBoundingClientRect();

    // 计算调整后的位置
    const adjustedX =
      x + rect.width > innerWidth + scrollX
        ? innerWidth + scrollX - rect.width - 10
        : x;
    const adjustedY =
      y + rect.height > innerHeight + scrollY
        ? innerHeight + scrollY - rect.height - 10
        : y;

    popup.style.left = `${adjustedX}px`;
    popup.style.top = `${adjustedY}px`;
  }
  // 拆分 class 值
  function splitClassValues(classValue) {
    return classValue
      .split(/\s+/)
      .map(
        (cls) =>
          `<div>class: <span class="copyable" data-copy="${cls}">${cls}</span></div>`
      )
      .join("");
  }

  // 自动生成 CSS 选择器
  function getCssSelector(element) {
    return `${getTreeCssSelector(element.parentNode, 1)}${getElementCssSelector(
      element
    )}`;
  }

  function getElementCssSelector(element) {
    if (element === undefined || element.tagName === undefined) return "";
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const classes = removeBlackAttr("class", element.className)
      .value.split(/\s+/)
      .join(".");
    return `${tag}${id || (classes ? "." + classes : "")}`;
  }
  function getTreeCssSelector(element, deep = 2) {
    if (element === undefined || element.tagName === undefined) return "";
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const classes = removeBlackAttr("class", element.className)
      .value.split(/\s+/)
      .join(".");
    if (deep > 0 && id === "" && classes === "")
      return getTreeCssSelector(element.parentNode, deep - 1) + tag + " > ";
    return `${tag}${id || (classes ? "." + classes : "")} > `;
  }
  // 复制到剪贴板
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Failed to copy: ", err);
    });
  }
})();
