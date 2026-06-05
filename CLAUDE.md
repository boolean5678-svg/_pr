# MR.TAN 作品集网站 — 开发记录

## 已确认效果

### 项目页 — 图片放大
- `transform: scale(1.62)`，JS 驱动，不改变 width/max-height
- 动画时长 3s，缓动 ease-in-out（先慢→快→慢）
- 触发条件：计算每张图片的中心点，取距离视口中心点最近的图片，触发该图片放大
  - 判断逻辑：`Math.abs(imgCenter - viewportCenter)` 取最小值，避免多张图片同时匹配
  - **防抖机制**：`checkCenterRow` 通过 200ms 防抖延迟执行，滚动过程中不触发放大，等用户停止滚动后才触发。首次加载时通过 `initialTrigger` 绕过防抖，立即执行
  - **动画期间守卫**：`checkCenterRowNow` 若 `scrollAnimId` 活跃（放大动画进行中）直接 return，防止 computeCenteredScroll 按放大后视觉中心算 scrollTop 引发的级联选中（scale=1 时图片中心偏上→下一张图更近→抢焦点→循环至末图）
  - **已放大图片重新居中**：`updateState` 若 `shrinkAnimId` 为 null（无缩小动画进行中）则重置 `pendingRow = null`，允许同一图片在用户滚动后被重新选中。`checkCenterRowNow` 不再检查 `ACTIVE_CLASS`，改为信任 `enlargeImg` 中的 `isNew` 判断——若 `!isNew` 且 `shouldScroll !== false`，直接调用 `computeCenteredScroll(img, 0)`（`extraOffset=0`，因为 margin 已生效）修正滚动位置，确保同张图片在用户滚动后不丢失居中
  - **所有触发均自动滚屏居中**：首次加载、滚动停止自动触发、点击触发，均传 `enlargeImg(img, true)`，全部居中
  - **居中机制**：`computeCenteredScroll` 用 `rect.height * 0.5`（图片原始半高，transform-origin: center 不改变视觉中心位置）+ `maxOverflow`（margin 补偿）计算放大后的真实视觉中心，在动画首帧瞬间设置 `view.scrollTop = targetScroll`。视觉动画（scale/filter/margin/info）照常 3s 过渡。margin 从 0→maxOverflow 期间图片"沉降"到正中
  - 居中条件：`targetScroll > 0 || view.scrollTop > 0`（有滚动空间）。否则降级为纯视觉放大
  - **延迟初始化**：IIFE 不在页面加载时调用 `updateState()`（此时 `#view-projects` 为 `display: none`，`getBoundingClientRect` 全部归零）。改为在 `switchView` 切换到项目页时调用 `view._init()`
- 放大过程中点击同一图片：**不中断**动画，放大过程不受影响

### 项目页 — 图片缩小
- 默认大小 = 放大前的原始状态（scale: 1, filter: grayscale(0.2) brightness(0.95)）
- 触发条件（仅对放大图片生效）：图片可见部分 < 图片高度的 20% 时，触发平滑缩小
  - 判断逻辑：计算 rect 与视口 `[0, window.innerHeight]` 的交集高度，若 `visibleHeight < rect.height * 0.2` 则触发缩小
  - 缩小使用 `smoothShrink`，时长与放大相同（`ANIM_DURATION = 3000ms`），ease 曲线同步，确保相邻图片间距稳定
  - 点击切换和滚动触发两种缩小路径统一使用 `smoothShrink`，视觉一致
- 点击切换图片：旧图片通过 `smoothShrink` 平滑缩小（3s ease-in-out）
  - info 跟踪：水平位移用 `maxInfoShift`（= width * 0.31），垂直位移用 `startMargin`（= marginTop = height * 0.31），与放大动画的 info 位移量一致

### 项目页 — 动画架构
- 放大动画使用 `scrollAnimId`，缩小动画使用 `shrinkAnimId`，**两个 rAF ID 独立**
- **首帧等待图片渲染**：step 首帧检查 `img.getBoundingClientRect().height === 0`，若为 0 则 rAF 重试
- **首帧瞬间滚屏**：图片有高度后，计算 `targetScroll`，直接 `view.scrollTop = targetScroll`（一次性，不参与后续帧动画）
- **首帧存储关键值**：`maxOverflow`/`maxInfoShift` 在首帧优先读取 `row._maxOverflow`/`row._maxInfoShift`（首次放大时在 scale=1 状态下正确计算并存储），避免图片处于部分缩放状态时从当前渲染高度重新计算出偏大值导致居中偏移。`resetImageState` 会清除存储值，确保下次首次放大重新计算
- **缩小防重触发**：`updateState` 中 `smoothShrink` 前先清空 `activeImg`/`activeRow`，`pendingRow` 设为被缩小的行（非 null），阻止 `checkCenterRowNow` 立即重新放大同一行
- `smoothShrink` 只取消 `shrinkAnimId`，不影响 `scrollAnimId`
- **wheel 事件**：若 `scrollAnimId` 活跃（动画进行中），取消动画并用存储的 `_maxOverflow`/`_maxInfoShift` 瞬间完成放大状态，scrollTop 由用户接管。之后调用 `updateState`
- **scrollTop 边界保护**：`computeCenteredScroll` clamp 到 `[0, maxScroll]`
- **动画中断保护**：`shrinkingRow`/`shrinkingImg` 追踪当前缩小目标。新 `smoothShrink` 启动时若发现不同的未完成缩小，调用 `resetImageState` 彻底清理（移除 class、清空 inline style、清除存储值），消除僵尸图片
- `resetImageState(row, img)` 通用重置函数，清理所有样式、class 和存储值，被 `smoothShrink` 中断清理和 `_init` 复用

### 项目页 — 间距
- 所有相邻图片视觉间距 30px，放大/缩小过程及静止状态均不变
- 最后一张与倒数第二张间距必须 30px，与其他行一视同仁
- 间距由 `gap: 30px` + 放大时 margin 补偿实现，公式：视觉间距 = gap + margin - overflow = 30px
- `padding-top: 220px`（确保首图有足够空间滚动居中），`padding-bottom: 50vh`（确保末图可上滚居中）
- 放大时 margin 补偿维持间距不变

### 项目页 — 项目信息
- 始终在图片左侧，顶部与图片视觉顶部齐平
- `.proj-info` 使用 `position: relative; z-index: 1`，活跃时 JS 设为 `z-index: 2`（inline style）
- 水平居中方案：`balanceRows()` 在每个 `.proj-row` 末尾动态插入 `.proj-spacer`（`visibility: hidden`），宽度 = info 的 offsetWidth。flex 排列变为 `[info, 35px, img, 35px, spacer]`，spacer 平衡 info 宽度后 `justify-content: center` 使图片恰好居中。在 `_init` 和 `window.resize` 时调用
- `.proj-img` 设置 `position: relative; z-index: 0`，与 info 形成明确的层叠对比
- `.proj-row` 设置 `isolation: isolate`，创建独立的层叠上下文
- 放大过程 info 位移：`translate(-maxInfoShift*ease, -maxOverflow*ease)`，缩小过程：`translate(-maxInfoShift*(1-ease), -startMargin*(1-ease))`

### 页脚
- `.footer` 使用 `position: fixed; bottom: 40px; right: 70px; z-index: 100`
- 所有子页面统一位置，不受滚动影响

### 项目页 — 多图左右滑动切换
- 每项目含多张图片（6-7张），存放在 `images/projN/`
- 默认状态：所有图片 `display: none; position: relative`，仅 `.proj-img.active` 设为 `display: block`，处于文档流中，容器自然撑开
- 交叉淡入淡出时：旧图保持 `position: relative`（保持容器尺寸），添加 `.fading-out` 类（opacity 1→0, pointer-events: none）；新图添加 `.fading-in` 类（`position: absolute; top:0; left:0`，opacity 0→1, pointer-events: auto），叠加于旧图之上
- `switchImage()` 将新图高度强制对齐旧图自然高度（`oldRect.height / scale`），继承 enlarge 状态（scale/filter），通过 CSS transition 0.5s 交叉淡入淡出
- 600ms 后清理：移除 fading 类、旧图移除 active、新图添加 active（回到文档流）、清除内联样式
- 点击放大图片左半边 = 上一张，右半边 = 下一张
- 水平滑动切换同上（`deltaX > 15 && deltaX > deltaY * 1.3`）
- wheel 事件 `passive: false` 以支持 `preventDefault()`（仅水平滑动时阻止默认行为）
- 交叉淡入淡出期间忽略点击（检查 `fading-in`/`fading-out` class）

### 全局配色
- 强调色：`#c97d5a`
