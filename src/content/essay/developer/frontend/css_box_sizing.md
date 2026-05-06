---
title: CSS 中的两种盒子模型
subtitle: ""
date: 2025-10-03T02:54:15+08:00
lastmod: 2025-10-03T02:54:15+08:00
draft: false
authors: []
description: ""
tags:
  - CSS
  - 前端八股文
  - Web前端
categories:
  - 在前端搬砖的日子里
series:
  - 前端八股文基础
hiddenFromHomePage: false
hiddenFromSearch: false
featuredImage: https://img.dodolalorc.cn/i/2025/10/03/68dee77755776.png
featuredImagePreview: https://img.dodolalorc.cn/i/2025/10/03/68dee77755776.png
toc:
  enable: true
math:
  enable: true
lightgallery: false
license: ""
---

一个元素的“最终宽度”是由多个属性共同作用的结果，而一切都始于  `box-sizing`  属性，它决定了元素的宽度和高度如何计算。

## `box-sizing`  的值

`box-sizing`  有两个主要值：

###  `content-box`（默认值）

- 宽度和高度只包括**内容**区域。
- 你设置的  `width`  和  `height`  就是内容区（content）的尺寸。
- **内边距（padding）和边框（border）会额外加到元素的总宽度和总高度上。**

#### 公式

- `总宽度 = width + padding-left + padding-right + border-left + border-right`
- `总高度 = height + padding-top + padding-bottom + border-top + border-bottom`

### `border-box`

- **宽度和高度包括内容、内边距和边框。**
- 你设置的  `width`  和  `height`  已经包含了  `padding`  和  `border`。
- **内容区的实际宽度/高度会自动收缩。**

#### 公式

- `总宽度 = width`（你设置的）
- `总高度 = height`（你设置的）
- `内容区宽度 = width - padding-left - padding-right - border-left - border-right`
- `内容区高度 = height - padding-top - padding-bottom - border-top - border-bottom`

## 视觉化对比

假设我们有一个  `div`，设置了以下样式：

```css
div {
	width: 200px;
	height: 100px;
	padding: 20px;
	border: 5px solid blue;
}
```

**当  `box-sizing: content-box;`（默认）时：**

- 内容区宽：`200px`
- 内容区高：`100px`
- **总宽度**：`200 (内容) + 20 (左padding) + 20 (右padding) + 5 (左边框) + 5 (右边框) = 250px`
- **总高度**：`100 (内容) + 20 (上padding) + 20 (下padding) + 5 (上边框) + 5 (下边框) = 150px`

**当  `box-sizing: border-box;`  时：**

- **总宽度**：`200px`（你设置的，包含了 padding 和 border）
- **总高度**：`100px`（你设置的，包含了 padding 和 border）
- 内容区宽：`200 - 20 - 20 - 5 - 5 = 150px`
- 内容区高：`100 - 20 - 20 - 5 - 5 = 50px`

对比图：

| `box-sizing: content-box;`                                                 | `box-sizing: border-box;`                                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ![image.png](https://img.dodolalorc.cn/i/2025/10/03/68deceec35517.png)<br> | ![image.png](https://img.dodolalorc.cn/i/2025/10/03/68deced754c47.png)<br> |

> [!tip]+ 为什么不是计算的 250×150
>
> 1. **浏览器缩放级别**：如果浏览器缩放不是 100%，会导致像素值出现小数
> 2. **设备像素比 (DPR)**：高分辨率显示器的设备像素比可能导致计算结果出现小数
> 3. **字体大小影响**：某些情况下浏览器的默认字体大小设置会影响布局计算

可以发现`content-box`属性会受一些非代码问题导致的样式问题，如果对样式有更高像素级的追求，可以优先选择更直观的模型`border-box`。

## 边界盒模型重置

边界盒模型重置一般是考虑上面实践中看到的受设备、字体大小等影响最终样式的问题，可以在在 CSS 开头使用通配符重置盒子模型。

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

这样，所有元素（包括伪元素）都使用更直观的  `border-box`  模型。

## 特殊情况和注意事项（debug 思路）

### `margin`  折叠

可阅读：[CSS Margin 折叠](/01-developer/frontend/margin_fold.md)

- 对于**块级元素**，在垂直方向上的相邻  `margin`  会发生折叠（合并）。
- 例如，上面盒子的  `margin-bottom: 30px`  和下面盒子的  `margin-top: 40px`  相遇，它们之间的实际距离是  `max(30px, 40px) = 40px`，而不是  `70px`。

### `box-sizing: inherit`

- 让元素继承其父元素的  `box-sizing`  值。

### `outline`（轮廓）

- 类似于  `border`，但它**不占用空间**，绘制在元素边框之外，不影响元素尺寸和位置。常用于高亮或`:focus`状态。

## 小结

要精确控制一个元素的尺寸，需要综合考虑一个“属性链”：

**`box-sizing` → `width`/`height` → `padding` → `border` → `margin`**
