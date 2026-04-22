---
title: "📷 图片懒加载原理和实现"
description: "原理和介绍"
date: 2025-09-17T12:17:25+08:00
tags: ["前端八股文", "Web前端", "性能优化"]
draft: false
badge: "前端"
---
# 原理和介绍

图片懒加载是一种优化网页性能的技术，也叫延迟加载，它延迟加载页面中的图片，直到用户滚动到图片附近时才加载，从而减少初始页面加载时间和带宽使用。

其核心原理是：

- 将图片地址存储到  `data-xxx`  属性上，而非`src`
- 绑定  `scroll`  监听事件
- 判断图片是否在可视区域
- 如果在，就设置图片  `src`

只加载当前视口内或即将进入视口的图片，而其他图片则用占位符替代。当用户滚动页面时，检测图片是否进入可视区域，如果是则加载真实图片。

有两种方式实现这种监听，同步（监听`scroll`事件）、异步（使用`Intersection Observer API`）

# 同步方案

## 页面 HTML

```html
<div class="image-container">
  <div class="lazy-image">
	<div class="placeholder">加载中...</div>
	<img data-src="https://picsum.photos/id/10/800/600" alt="风景图片1" />
	<div class="caption">图1：美丽的山水风景</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">加载中...</div>
	<img data-src="https://picsum.photos/id/11/800/600" alt="风景图片2" />
	<div class="caption">图2：宁静的湖泊</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">加载中...</div>
	<img data-src="https://picsum.photos/id/12/800/600" alt="风景图片3" />
	<div class="caption">图3：壮丽的山脉</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">加载中...</div>
	<img data-src="https://picsum.photos/id/13/800/600" alt="风景图片4" />
	<div class="caption">图4：海滩日落</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">加载中...</div>
	<img data-src="https://picsum.photos/id/14/800/600" alt="风景图片5" />
	<div class="caption">图5：绿色山谷</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">加载中...</div>
	<img data-src="https://picsum.photos/id/15/800/600" alt="风景图片6" />
	<div class="caption">图6：城市天际线</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">加载中...</div>
	<img data-src="https://picsum.photos/id/16/800/600" alt="风景图片7" />
	<div class="caption">图7：雪山美景</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">加载中...</div>
	<img data-src="https://picsum.photos/id/17/800/600" alt="风景图片8" />
	<div class="caption">图8：森林小径</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">加载中...</div>
	<img data-src="https://picsum.photos/id/18/800/600" alt="风景图片9" />
	<div class="caption">图9：沙漠景观</div>
  </div>
</div>

<div class="loading-info">
  已加载图片: <span id="loaded-count">0</span> /
  <span id="total-count">9</span>
</div>
```

## 关键代码

```js showLineNumbers warp {27-37}
document.addEventListener("DOMContentLoaded", function () {
	// 获取所有需要懒加载的图片
	const lazyImages = document.querySelectorAll("img[data-src]");
	const totalCount = document.getElementById("total-count");
	const loadedCount = document.getElementById("loaded-count");

	totalCount.textContent = lazyImages.length;
	loadedCount.textContent = 0;

	// 加载图片函数
	function loadImage(img) {
	  const src = img.getAttribute("data-src");
	  if (!src) return;

	  img.onload = function () {
		// 图片加载完成后，隐藏占位符
		img.previousElementSibling.style.display = "none";
		// 增加已加载计数
		loadedCount.textContent = parseInt(loadedCount.textContent) + 1;
	  };

	  img.src = src;
	  img.removeAttribute("data-src");
	}

	// 检查图片是否在视口中
	function checkImages() {
	  lazyImages.forEach((img) => {
		if (img.hasAttribute("data-src")) {
		  const rect = img.getBoundingClientRect();
		  // 当图片顶部在视口底部以上，且图片底部在视口顶部以下时（即图片在视口内）
		  if (rect.top < window.innerHeight && rect.bottom > 0) {
			loadImage(img);
		  }
		}
	  });
	}

	// 初始检查
	checkImages();

	// 监听滚动事件（使用防抖优化性能）
	let isThrottled = false;
	function throttleCheck() {
	  if (!isThrottled) {
		isThrottled = true;
		setTimeout(() => {
		  checkImages();
		  isThrottled = false;
		}, 100);
	  }
	}

	window.addEventListener("scroll", throttleCheck);
	window.addEventListener("resize", throttleCheck);
});
```

# 异步方案

使用现代浏览器 API：Intersection Observer API，可以参考这里的[介绍和用例](/01-developer/frontend/intersection_observer_api### 图片懒加载)。
