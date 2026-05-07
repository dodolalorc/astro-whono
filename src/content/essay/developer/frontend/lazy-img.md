---
title: ?? ͼƬ������ԭ����ʵ��
subtitle: ""
date: 2025-09-17T12:17:25+08:00
lastmod: 2025-09-17T12:17:25+08:00
draft: false
authors: []
description: "ԭ���ͽ��� ͼƬ��������һ���Ż���ҳ���ܵļ�����Ҳ���ӳټ���"
tags:
  - ǰ�˰˹���
  - Webǰ��
  - �����Ż�
categories:
  - ��ǰ�˰�ש��������
series:
  - ǰ�˰˹��Ļ���
hiddenFromHomePage: false
hiddenFromSearch: false
toc:
  enable: true
math:
  enable: true
lightgallery: false
license: ""
---

# ԭ���ͽ���

ͼƬ��������һ���Ż���ҳ���ܵļ�����Ҳ���ӳټ��أ����ӳټ���ҳ���е�ͼƬ��ֱ���û�������ͼƬ����ʱ�ż��أ��Ӷ����ٳ�ʼҳ�����ʱ��ʹ���ʹ�á�

�����ԭ���ǣ�

- ��ͼƬ��ַ�洢�� ?`data-xxx`? �����ϣ�����`src`
- �� ?`scroll`? �����¼�
- �ж�ͼƬ�Ƿ��ڿ�������
- ����ڣ�������ͼƬ ?`src`

ֻ���ص�ǰ�ӿ��ڻ򼴽������ӿڵ�ͼƬ��������ͼƬ����ռλ����������û�����ҳ��ʱ�����ͼƬ�Ƿ�����������������������ʵͼƬ��

�����ַ�ʽʵ�����ּ�����ͬ��������`scroll`�¼������첽��ʹ��`Intersection Observer API`��

# ͬ������

## ҳ�� HTML

```html
<div class="image-container">
  <div class="lazy-image">
	<div class="placeholder">������...</div>
	<img data-src="https://picsum.photos/id/10/800/600" alt="�羰ͼƬ1" />
	<div class="caption">ͼ1��������ɽˮ�羰</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">������...</div>
	<img data-src="https://picsum.photos/id/11/800/600" alt="�羰ͼƬ2" />
	<div class="caption">ͼ2�������ĺ���</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">������...</div>
	<img data-src="https://picsum.photos/id/12/800/600" alt="�羰ͼƬ3" />
	<div class="caption">ͼ3��׳����ɽ��</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">������...</div>
	<img data-src="https://picsum.photos/id/13/800/600" alt="�羰ͼƬ4" />
	<div class="caption">ͼ4����̲����</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">������...</div>
	<img data-src="https://picsum.photos/id/14/800/600" alt="�羰ͼƬ5" />
	<div class="caption">ͼ5����ɫɽ��</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">������...</div>
	<img data-src="https://picsum.photos/id/15/800/600" alt="�羰ͼƬ6" />
	<div class="caption">ͼ6�����������</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">������...</div>
	<img data-src="https://picsum.photos/id/16/800/600" alt="�羰ͼƬ7" />
	<div class="caption">ͼ7��ѩɽ����</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">������...</div>
	<img data-src="https://picsum.photos/id/17/800/600" alt="�羰ͼƬ8" />
	<div class="caption">ͼ8��ɭ��С��</div>
  </div>

  <div class="lazy-image">
	<div class="placeholder">������...</div>
	<img data-src="https://picsum.photos/id/18/800/600" alt="�羰ͼƬ9" />
	<div class="caption">ͼ9��ɳĮ����</div>
  </div>
</div>

<div class="loading-info">
  �Ѽ���ͼƬ: <span id="loaded-count">0</span> /
  <span id="total-count">9</span>
</div>
```

## �ؼ�����

```js showLineNumbers warp {27-37}
document.addEventListener("DOMContentLoaded", function () {
	// ��ȡ������Ҫ�����ص�ͼƬ
	const lazyImages = document.querySelectorAll("img[data-src]");
	const totalCount = document.getElementById("total-count");
	const loadedCount = document.getElementById("loaded-count");

	totalCount.textContent = lazyImages.length;
	loadedCount.textContent = 0;

	// ����ͼƬ����
	function loadImage(img) {
	  const src = img.getAttribute("data-src");
	  if (!src) return;

	  img.onload = function () {
		// ͼƬ������ɺ�����ռλ��
		img.previousElementSibling.style.display = "none";
		// �����Ѽ��ؼ���
		loadedCount.textContent = parseInt(loadedCount.textContent) + 1;
	  };

	  img.src = src;
	  img.removeAttribute("data-src");
	}

	// ���ͼƬ�Ƿ����ӿ���
	function checkImages() {
	  lazyImages.forEach((img) => {
		if (img.hasAttribute("data-src")) {
		  const rect = img.getBoundingClientRect();
		  // ��ͼƬ�������ӿڵײ����ϣ���ͼƬ�ײ����ӿڶ�������ʱ����ͼƬ���ӿ��ڣ�
		  if (rect.top < window.innerHeight && rect.bottom > 0) {
			loadImage(img);
		  }
		}
	  });
	}

	// ��ʼ���
	checkImages();

	// ���������¼���ʹ�÷����Ż����ܣ�
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

# �첽����

ʹ���ִ������ API��Intersection Observer API�����Բο������[���ܺ�����](/01-developer/frontend/intersection-observer-api### ͼƬ������)��
