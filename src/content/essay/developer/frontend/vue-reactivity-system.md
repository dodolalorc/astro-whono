---
title: Vue 中的响应式原理 | 对比 Vue 的 Proxy 和 React 的 setState
subtitle: ""
date: 2025-10-02T17:16:24+08:00
lastmod: 2025-10-02T17:16:24+08:00
draft: false
authors: []
description: "Vue 2 和 Vue 3 的响应式系统存在一些区别，本篇主"
tags:
  - 前端八股文
  - Web前端
categories:
  - 在前端搬砖的日子里
series:
  - 前端八股文基础
hiddenFromHomePage: false
hiddenFromSearch: false
featuredImage: https://img.dodolalorc.cn/i/2025/10/03/68dec8aad494a.png
featuredImagePreview: https://img.dodolalorc.cn/i/2025/10/03/68dec8aad494a.png
toc:
  enable: true
math:
  enable: true
lightgallery: false
license: ""
---

`Vue 2` 和 `Vue 3`的响应式系统存在一些区别，本篇主要介绍`Vue 3`，可以移步[Vue2 和 Vue3 区别](/01-developer/frontend/frontend-common)。

Vue 和 React 在处理状态到视图的更新上，走了两条截然不同的技术路线，这体现了它们在设计哲学上的根本差异。

## Vue3 的 Proxy

Vue 采用的是一种**基于依赖追踪的、细粒度的自动响应式系统**。在 Vue3 中，通过 `Proxy`（Vue2 中为`object.defineProperty`）对数据对象进行代理。当组件渲染时，它会访问这些数据，触发代理的 `get` 拦截器。此时，Vue 会将当前正在渲染的组件的更新函数（`effect`）作为”依赖”，收集起来。当数据被修改时，会触发 set 拦截器，Vue 会精确地找到所有依赖该数据的 `effect`，并重新执行它们。这个过程是自动且精准的，开发者只需关心数据的修改，视图更新由框架透明地完成。

### 实现思路

1. 使用 Proxy 包装对象，拦截对对象属性的访问和修改
2. 建立依赖收集机制，跟踪哪些副作用函数依赖于哪些属性
3. 当属性变化时，触发相关的副作用函数重新执行

## React 的 setState

相比之下，React 的更新机制是**基于不可变性（Immutability）和手动触发的**。React 本身并不“知道”你的数据何时以及如何变化。你必须通过调用 setState（或 useState 的更新函数）来明确告知 React：“状态已变，请启动更新”。收到通知后，React 会将该组件及其子组件标记为“脏”，然后启动自上而下的协调过程，通过 Diff 算法找出变化并更新 DOM。这种方式默认是“粗粒度”的，但通过 `React.memo` 等优化手段可以避免不必要的子组件渲染。

总结来说，Vue 像是为每个数据配备了一个"监视器”，一旦数据变动，立即通知所有相关方；而 React 则像是一个“项目经理”，你必须向它提交一份”变更报告”（`setstate`） 它才会组织团队（组件树）进行一次全面的“评审”(`re-render` 和 `diff`）。
