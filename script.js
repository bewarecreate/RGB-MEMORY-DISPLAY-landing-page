document.documentElement.classList.add("js");

(() => {
  "use strict";

  const scene = document.querySelector("[data-hero-scene]");
  const stage = scene?.querySelector(".hero-stage");
  const image = scene?.querySelector(".hero-image");

  if (!scene || !stage || !image) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stageStyle = stage.style;

  /*
   * 전체 연출 구간입니다.
   * 숫자는 0~1 사이의 스크롤 진행률이며, 이후 섹션을 붙일 때도 같은 구조로 확장합니다.
   */
  const TIMING = {
    titleIn: [0.055, 0.18],
    titleOut: [0.34, 0.46],
    firstDim: [0.035, 0.20],
    imagePan: [0.25, 0.67],
    fullBlack: [0.52, 0.76],
    iconIn: [0.765, 0.825],
    copyIn: [0.795, 0.875],
  };

  let targetProgress = 0;
  let smoothProgress = 0;
  let sceneTop = 0;
  let scrollRange = 1;
  let maxImagePan = 0;
  let frameId = 0;
  let resizeTimer = 0;
  let lastTime = performance.now();
  let initialized = false;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const mix = (from, to, amount) => from + (to - from) * amount;

  const range = (progress, start, end) => {
    if (start === end) return progress >= end ? 1 : 0;
    return clamp((progress - start) / (end - start));
  };

  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

  const setNumber = (name, value, suffix = "") => {
    stageStyle.setProperty(name, `${value}${suffix}`);
  };

  const updateTargetProgress = () => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    targetProgress = clamp((scrollY - sceneTop) / scrollRange);
  };

  const measure = () => {
    const rect = scene.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

    sceneTop = scrollY + rect.top;

    /*
     * window.innerHeight 대신 실제 sticky stage 높이를 사용합니다.
     * 모바일 주소창이 접히고 펼쳐질 때 진행률이 되감기는 현상을 방지합니다.
     */
    scrollRange = Math.max(1, scene.offsetHeight - stage.offsetHeight);
    maxImagePan = Math.max(0, image.offsetHeight - stage.offsetHeight);

    updateTargetProgress();

    if (!initialized) {
      smoothProgress = targetProgress;
      initialized = true;
    }
  };

  const render = (progress) => {
    const titleIn = easeOutQuint(range(progress, ...TIMING.titleIn));
    const titleOut = easeInOutCubic(range(progress, ...TIMING.titleOut));
    const titleVisibility = titleIn * (1 - titleOut);

    const firstDim = easeInOutSine(range(progress, ...TIMING.firstDim));
    const imagePan = easeInOutCubic(range(progress, ...TIMING.imagePan));
    const fullBlack = easeInOutSine(range(progress, ...TIMING.fullBlack));
    const blackoutOpacity = mix(0, 0.57, firstDim) + mix(0, 0.43, fullBlack);

    const iconIn = easeOutQuint(range(progress, ...TIMING.iconIn));
    const copyIn = easeOutQuint(range(progress, ...TIMING.copyIn));

    /* object-position 대신 GPU 합성 가능한 translate3d만 사용합니다. */
    setNumber("--media-translate-y", mix(0, -maxImagePan, imagePan), "px");
    setNumber("--media-scale", mix(1, 1.008, imagePan));

    setNumber("--vignette-opacity", mix(0, 0.72, firstDim));
    setNumber("--blackout-opacity", clamp(blackoutOpacity));

    setNumber("--title-opacity", titleVisibility);
    setNumber("--title-y", mix(54, 0, titleIn) + mix(0, -20, titleOut), "px");
    setNumber("--title-scale", mix(0.992, 1, titleIn));

    setNumber("--intro-icon-opacity", iconIn);
    setNumber("--intro-icon-y", mix(22, 0, iconIn), "px");
    setNumber("--intro-copy-opacity", copyIn);
    setNumber("--intro-copy-y", mix(34, 0, copyIn), "px");
  };

  const animate = (now) => {
    frameId = 0;

    const delta = Math.min(40, now - lastTime);
    lastTime = now;

    if (reduceMotion.matches) {
      smoothProgress = targetProgress;
    } else {
      /*
       * 네이티브 스크롤은 그대로 두고 연출만 아주 짧게 보간합니다.
       * 이전보다 반응을 빠르게 만들어 휠과 트랙패드에서 뒤처지거나 튕겨 보이지 않습니다.
       */
      const damping = 1 - Math.exp(-delta * 0.028);
      smoothProgress += (targetProgress - smoothProgress) * damping;
    }

    if (Math.abs(targetProgress - smoothProgress) < 0.00008) {
      smoothProgress = targetProgress;
    }

    render(smoothProgress);

    if (Math.abs(targetProgress - smoothProgress) > 0.00008) {
      frameId = requestAnimationFrame(animate);
    }
  };

  const wake = () => {
    updateTargetProgress();

    if (!frameId) {
      lastTime = performance.now();
      frameId = requestAnimationFrame(animate);
    }
  };

  const scheduleMeasure = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      measure();
      wake();
    }, 120);
  };

  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", scheduleMeasure, { passive: true });
  window.addEventListener("orientationchange", scheduleMeasure, { passive: true });
  reduceMotion.addEventListener?.("change", wake);

  if (image.complete) {
    measure();
    render(smoothProgress);
  } else {
    image.addEventListener(
      "load",
      () => {
        measure();
        render(smoothProgress);
      },
      { once: true }
    );
  }

  frameId = requestAnimationFrame(animate);
})();


(() => {
  "use strict";

  const revealItems = [...document.querySelectorAll(".section-reveal")];
  const counterGroup = document.querySelector("[data-counter-group]");
  const counters = counterGroup
    ? [...counterGroup.querySelectorAll("[data-count]")]
    : [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const showAll = () => {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  };

  if (!("IntersectionObserver" in window)) {
    showAll();
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  if (!counterGroup || counters.length === 0) return;

  const setFinalValues = () => {
    counters.forEach((counter) => {
      counter.textContent = Number(counter.dataset.count || 0).toLocaleString("ko-KR");
    });
  };

  const animateCounter = (counter, duration) => {
    const target = Number(counter.dataset.count || 0);
    const startedAt = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const value = Math.min(target, Math.round(target * eased));

      counter.textContent = value.toLocaleString("ko-KR");

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        counter.textContent = target.toLocaleString("ko-KR");
      }
    };

    requestAnimationFrame(tick);
  };

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    setFinalValues();
    return;
  }

  /* 화면에 진입하기 전에는 0으로 대기하고, 진입 시 한 번만 빠르게 증가합니다. */
  counters.forEach((counter) => {
    counter.textContent = "0";
  });

  const counterObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        counters.forEach((counter, index) => {
          const target = Number(counter.dataset.count || 0);
          const duration = target >= 60 ? 980 : target >= 10 ? 860 : 720;

          window.setTimeout(() => {
            animateCounter(counter, duration);
          }, index * 80);
        });

        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.45,
      rootMargin: "0px 0px -5% 0px",
    }
  );

  counterObserver.observe(counterGroup);
})();

(() => {
  "use strict";

  /*
   * SECTION 03
   * 세로 스크롤은 브라우저 기본 동작을 그대로 사용하고,
   * 화면 중앙에 가장 가까운 문단만 활성화해 우측 CSS 제품 상태와 연결합니다.
   */
  const stickyStory = document.querySelector("[data-sticky-story]");

  if (!stickyStory) return;

  const steps = [...stickyStory.querySelectorAll("[data-step]")];

  const setStoryState = (step) => {
    const state = step.dataset.step || "0";

    stickyStory.dataset.state = state;

    steps.forEach((item) => {
      item.classList.toggle("is-active", item === step);
    });
  };

  if (steps[0]) {
    setStoryState(steps[0]);
  }

  if (!("IntersectionObserver" in window)) return;

  const stepObserver = new IntersectionObserver(
    (entries) => {
      const visibleStep = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visibleStep) {
        setStoryState(visibleStep.target);
      }
    },
    {
      rootMargin: "-24% 0px -36% 0px",
      threshold: [0.1, 0.35, 0.6],
    }
  );

  steps.forEach((step) => stepObserver.observe(step));
})();



(() => {
  "use strict";

  /*
   * SECTION 04 — 맞춤형 디자인 카드
   * 터치 환경은 브라우저의 네이티브 수평 스와이프를 그대로 사용합니다.
   * 데스크톱에서는 마우스를 누른 채 좌우로 끌면 자연스럽게 스크롤됩니다.
   * 휠/세로 스크롤은 가로채지 않습니다.
   */
  const carousel = document.querySelector("[data-design-carousel]");
  if (!carousel) return;

  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startScrollLeft = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let inertiaFrame = 0;

  const stopInertia = () => {
    if (!inertiaFrame) return;
    cancelAnimationFrame(inertiaFrame);
    inertiaFrame = 0;
  };

  const beginDrag = (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    stopInertia();
    dragging = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = carousel.scrollLeft;
    lastX = event.clientX;
    lastTime = performance.now();
    velocity = 0;

    carousel.classList.add("is-dragging");
    carousel.setPointerCapture?.(pointerId);
    event.preventDefault();
  };

  const moveDrag = (event) => {
    if (!dragging || event.pointerId !== pointerId) return;

    const now = performance.now();
    const delta = event.clientX - startX;
    const dt = Math.max(1, now - lastTime);

    carousel.scrollLeft = startScrollLeft - delta;
    velocity = (lastX - event.clientX) / dt;
    lastX = event.clientX;
    lastTime = now;
    event.preventDefault();
  };

  const runInertia = () => {
    stopInertia();

    let speed = Math.max(-2.2, Math.min(2.2, velocity * 17));
    if (Math.abs(speed) < 0.35) return;

    const tick = () => {
      speed *= 0.92;
      carousel.scrollLeft += speed;

      if (Math.abs(speed) > 0.12) {
        inertiaFrame = requestAnimationFrame(tick);
      } else {
        inertiaFrame = 0;
      }
    };

    inertiaFrame = requestAnimationFrame(tick);
  };

  const endDrag = (event) => {
    if (!dragging || (event && event.pointerId !== pointerId)) return;

    dragging = false;
    carousel.classList.remove("is-dragging");

    if (pointerId !== null) {
      try {
        carousel.releasePointerCapture?.(pointerId);
      } catch (_) {
        // 이미 캡처가 해제된 경우는 무시합니다.
      }
    }

    pointerId = null;
    runInertia();
  };

  carousel.addEventListener("pointerdown", beginDrag);
  carousel.addEventListener("pointermove", moveDrag);
  carousel.addEventListener("pointerup", endDrag);
  carousel.addEventListener("pointercancel", endDrag);
  carousel.addEventListener("lostpointercapture", () => endDrag());

  carousel.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const card = carousel.querySelector(".design-card");
    const track = carousel.querySelector(".design-track");
    if (!card || !track) return;

    const gap = parseFloat(getComputedStyle(track).gap || "0") || 0;
    const distance = card.getBoundingClientRect().width + gap;

    carousel.scrollBy({
      left: event.key === "ArrowRight" ? distance : -distance,
      behavior: "smooth",
    });

    event.preventDefault();
  });
})();

(() => {
  "use strict";

  /*
   * SECTION 05 — 세로 스크롤 → 수평 전환
   * - wheel / touch 스크롤을 preventDefault 하지 않습니다.
   * - sticky 구간 안에서 세로 진행률만 읽어 track에 translate3d를 적용합니다.
   * - 3장 기준: 약 1 viewport를 아래로 이동할 때마다 다음 장면에 도달합니다.
   * - requestAnimationFrame + transform만 사용해 레이아웃 재계산을 최소화합니다.
   */
  const section = document.querySelector(".showcase-section");
  const viewport = document.querySelector("[data-showcase-scroll]");
  if (!section || !viewport) return;

  const track = viewport.querySelector(".showcase-track");
  const slides = [...viewport.querySelectorAll(".showcase-slide")];
  if (!track || slides.length < 2) return;

  let targetX = 0;
  let currentX = 0;
  let frame = 0;
  let lastWidth = window.innerWidth;
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const measureTarget = () => {
    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const scrollable = Math.max(1, section.offsetHeight - viewportHeight);
    const travelled = clamp(-rect.top, 0, scrollable);
    const progress = travelled / scrollable;
    const maxX = Math.max(0, (slides.length - 1) * (window.innerWidth || viewport.clientWidth));

    targetX = -progress * maxX;
  };

  const render = () => {
    frame = 0;

    if (reducedMotion) {
      currentX = targetX;
    } else {
      /* 짧은 관성만 추가해 휠/트랙패드 입력이 딱딱하게 끊기지 않도록 합니다. */
      currentX += (targetX - currentX) * 0.16;
      if (Math.abs(targetX - currentX) < 0.1) currentX = targetX;
    }

    track.style.transform = `translate3d(${currentX.toFixed(2)}px, 0, 0)`;

    if (Math.abs(targetX - currentX) > 0.1) {
      frame = window.requestAnimationFrame(render);
    }
  };

  const requestRender = () => {
    measureTarget();
    if (!frame) frame = window.requestAnimationFrame(render);
  };

  window.addEventListener("scroll", requestRender, { passive: true });

  let resizeTimer = 0;
  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const width = window.innerWidth;
        if (Math.abs(width - lastWidth) > 1) lastWidth = width;
        requestRender();
      }, 80);
    },
    { passive: true }
  );

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener?.("change", (event) => {
    reducedMotion = event.matches;
    requestRender();
  });

  requestRender();
})();


(() => {
  "use strict";

  /*
   * SECTION 06 — RGB 인터랙션
   * 기존 제안서의 Color / Effect 컨트롤을 그대로 유지하되
   * 이 섹션 내부 CSS 변수만 변경해 다른 섹션의 RGB 애니메이션에는 영향을 주지 않습니다.
   */
  const section = document.querySelector("[data-interactive-rgb]");
  if (!section) return;

  const demo = section.querySelector("[data-interactive-rgb-demo]");
  const readout = section.querySelector("[data-interactive-color-readout]");
  const colorButtons = [...section.querySelectorAll("[data-interactive-rgb-color]")];
  const modeButtons = [...section.querySelectorAll("[data-interactive-rgb-mode]")];

  const hexToRgb = (hex) => {
    const normalized = hex.replace("#", "");
    const value = Number.parseInt(normalized, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    };
  };

  colorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const color = button.dataset.interactiveRgbColor || "#7c5cff";
      const { r, g, b } = hexToRgb(color);

      section.style.setProperty("--interactive-rgb", color);
      section.style.setProperty("--interactive-rgb-r", String(r));
      section.style.setProperty("--interactive-rgb-g", String(g));
      section.style.setProperty("--interactive-rgb-b", String(b));

      if (readout) readout.textContent = color.toUpperCase();

      colorButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
    });
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.interactiveRgbMode || "flow";
      demo?.classList.remove("mode-flow", "mode-pulse", "mode-static");
      demo?.classList.add(`mode-${mode}`);

      modeButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
    });
  });
})();

(() => {
  "use strict";

  /*
   * SECTION 08 — 활용 사례 무한 오토 루프 + 드래그
   * - 기본 상태에서는 카드가 일정 속도로 자동 순환합니다.
   * - 마우스/포인터를 누른 채 좌우로 드래그하면 자동 재생을 잠시 멈추고 직접 이동합니다.
   * - 놓은 뒤에는 짧은 관성으로 이어진 후 같은 위치에서 자동 루프를 자연스럽게 재개합니다.
   * - 원본 5장을 한 세트 더 복제하고 정확히 한 세트 폭을 기준으로 좌표를 순환시켜
   *   양방향 드래그에서도 마지막/처음 경계가 끊기지 않습니다.
   */
  const carousel = document.querySelector("[data-usage-carousel]");
  const track = carousel?.querySelector(".usage-track");
  if (!carousel || !track) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const originals = Array.from(track.children);
  if (!originals.length) return;

  originals.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("img").forEach((img) => {
      img.alt = "";
      img.loading = "lazy";
    });
    track.appendChild(clone);
  });

  let cycleWidth = 0;
  let offset = 0;
  let previousTime = 0;
  let frame = 0;
  let inView = false;
  let pageVisible = !document.hidden;

  let dragging = false;
  let pointerId = null;
  let lastPointerX = 0;
  let lastPointerTime = 0;
  let inertiaVelocity = 0; // px/s, offset 기준. +는 다음 카드 방향.

  const LOOP_SPEED = 36;
  const INERTIA_FRICTION = 5.8;
  const MIN_INERTIA = 4;
  const MAX_DRAG_SPEED = 2200;

  const wrapOffset = (value) => {
    if (!cycleWidth) return 0;
    return ((value % cycleWidth) + cycleWidth) % cycleWidth;
  };

  const render = () => {
    track.style.transform = `translate3d(${-offset.toFixed(2)}px, 0, 0)`;
  };

  const measure = () => {
    const first = track.children[0];
    const firstClone = track.children[originals.length];
    if (!first || !firstClone) return;

    const oldWidth = cycleWidth;
    cycleWidth = firstClone.offsetLeft - first.offsetLeft;

    if (oldWidth > 0 && cycleWidth > 0) {
      offset = wrapOffset((offset / oldWidth) * cycleWidth);
    } else {
      offset = wrapOffset(offset);
    }

    render();
  };

  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  };

  const tick = (time) => {
    if (!inView || !pageVisible || reduceMotion.matches || dragging) {
      stop();
      return;
    }

    if (!previousTime) previousTime = time;
    const deltaSeconds = Math.min(0.05, (time - previousTime) / 1000);
    previousTime = time;

    if (cycleWidth > 0) {
      // 손을 놓은 직후에는 사용자의 드래그 속도를 이어가고,
      // 그 속도가 감쇠되면서 기본 오토 루프 속도로 자연스럽게 복귀합니다.
      offset = wrapOffset(offset + (LOOP_SPEED + inertiaVelocity) * deltaSeconds);

      if (Math.abs(inertiaVelocity) > MIN_INERTIA) {
        inertiaVelocity *= Math.exp(-INERTIA_FRICTION * deltaSeconds);
      } else {
        inertiaVelocity = 0;
      }

      render();
    }

    frame = requestAnimationFrame(tick);
  };

  const start = () => {
    if (frame || dragging || !inView || !pageVisible || reduceMotion.matches) return;
    previousTime = 0;
    frame = requestAnimationFrame(tick);
  };

  const beginDrag = (event) => {
    if (reduceMotion.matches) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    dragging = true;
    pointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerTime = performance.now();
    inertiaVelocity = 0;

    stop();
    carousel.classList.add("is-dragging");
    carousel.setPointerCapture?.(pointerId);
  };

  const moveDrag = (event) => {
    if (!dragging || event.pointerId !== pointerId || cycleWidth <= 0) return;

    const now = performance.now();
    const dx = event.clientX - lastPointerX;
    const dt = Math.max(8, now - lastPointerTime);

    // 포인터를 왼쪽으로 끌면 다음 카드가 보이도록 offset을 증가시킵니다.
    offset = wrapOffset(offset - dx);
    inertiaVelocity = Math.max(
      -MAX_DRAG_SPEED,
      Math.min(MAX_DRAG_SPEED, (-dx / dt) * 1000)
    );

    lastPointerX = event.clientX;
    lastPointerTime = now;
    render();

    if (event.pointerType === "mouse") event.preventDefault();
  };

  const endDrag = (event) => {
    if (!dragging) return;
    if (event?.pointerId != null && event.pointerId !== pointerId) return;

    const releasedPointerId = pointerId;
    dragging = false;
    pointerId = null;
    carousel.classList.remove("is-dragging");

    if (releasedPointerId != null && carousel.hasPointerCapture?.(releasedPointerId)) {
      carousel.releasePointerCapture(releasedPointerId);
    }

    start();
  };

  carousel.addEventListener("pointerdown", beginDrag);
  carousel.addEventListener("pointermove", moveDrag);
  carousel.addEventListener("pointerup", endDrag);
  carousel.addEventListener("pointercancel", endDrag);
  carousel.addEventListener("lostpointercapture", () => {
    if (dragging) endDrag();
  });

  const observer = new IntersectionObserver(
    ([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      if (inView) start();
      else stop();
    },
    { threshold: 0.08 }
  );

  observer.observe(carousel);

  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    if (pageVisible) start();
    else stop();
  });

  const onMotionChange = () => {
    if (reduceMotion.matches) {
      dragging = false;
      pointerId = null;
      inertiaVelocity = 0;
      carousel.classList.remove("is-dragging");
      stop();
      offset = 0;
      track.style.transform = "translate3d(0, 0, 0)";
    } else {
      measure();
      start();
    }
  };

  reduceMotion.addEventListener?.("change", onMotionChange);

  let resizeFrame = 0;
  window.addEventListener(
    "resize",
    () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(measure);
    },
    { passive: true }
  );

  requestAnimationFrame(() => {
    measure();
    requestAnimationFrame(measure);
  });
})();


(() => {
  "use strict";

  /*
   * SECTION 09 — 제작 프로세스 아코디언
   * 각 항목은 독립적으로 열고 닫을 수 있어 9-2 레퍼런스처럼
   * 여러 단계를 동시에 펼쳐 놓는 것도 가능합니다.
   */
  const root = document.querySelector("[data-process-accordion]");
  if (!root) return;

  const triggers = [...root.querySelectorAll(".process-trigger")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const closePanel = (button, panel) => {
    button.setAttribute("aria-expanded", "false");

    if (reduceMotion.matches) {
      panel.hidden = true;
      panel.style.height = "";
      return;
    }

    panel.style.height = `${panel.scrollHeight}px`;
    panel.getBoundingClientRect();
    panel.style.transition = "height 300ms cubic-bezier(.22,.61,.36,1)";
    panel.style.height = "0px";

    const done = () => {
      panel.hidden = true;
      panel.style.height = "";
      panel.style.transition = "";
      panel.removeEventListener("transitionend", done);
    };
    panel.addEventListener("transitionend", done);
  };

  const openPanel = (button, panel) => {
    button.setAttribute("aria-expanded", "true");
    panel.hidden = false;

    if (reduceMotion.matches) {
      panel.style.height = "";
      return;
    }

    panel.style.height = "0px";
    panel.getBoundingClientRect();
    panel.style.transition = "height 320ms cubic-bezier(.22,.61,.36,1)";
    panel.style.height = `${panel.scrollHeight}px`;

    const done = () => {
      panel.style.height = "auto";
      panel.style.transition = "";
      panel.removeEventListener("transitionend", done);
    };
    panel.addEventListener("transitionend", done);
  };

  triggers.forEach((button) => {
    const panelId = button.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;

    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      if (expanded) closePanel(button, panel);
      else openPanel(button, panel);
    });
  });
})();


(() => {
  "use strict";

  /* SECTION 10 — FAQ: 각 질문은 독립적으로 열고 닫습니다. */
  const root = document.querySelector("[data-faq-accordion]");
  if (!root) return;

  const triggers = [...root.querySelectorAll(".faq-trigger")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const closePanel = (button, panel) => {
    button.setAttribute("aria-expanded", "false");

    if (reduceMotion.matches) {
      panel.hidden = true;
      panel.style.height = "";
      return;
    }

    panel.style.height = `${panel.scrollHeight}px`;
    panel.getBoundingClientRect();
    panel.style.transition = "height 300ms cubic-bezier(.22,.61,.36,1)";
    panel.style.height = "0px";

    const done = () => {
      panel.hidden = true;
      panel.style.height = "";
      panel.style.transition = "";
      panel.removeEventListener("transitionend", done);
    };
    panel.addEventListener("transitionend", done);
  };

  const openPanel = (button, panel) => {
    button.setAttribute("aria-expanded", "true");
    panel.hidden = false;

    if (reduceMotion.matches) {
      panel.style.height = "";
      return;
    }

    panel.style.height = "0px";
    panel.getBoundingClientRect();
    panel.style.transition = "height 320ms cubic-bezier(.22,.61,.36,1)";
    panel.style.height = `${panel.scrollHeight}px`;

    const done = () => {
      panel.style.height = "auto";
      panel.style.transition = "";
      panel.removeEventListener("transitionend", done);
    };
    panel.addEventListener("transitionend", done);
  };

  triggers.forEach((button) => {
    const panelId = button.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;

    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      if (expanded) closePanel(button, panel);
      else openPanel(button, panel);
    });
  });
})();

(() => {
  "use strict";

  /* 고정 로고가 밝은 10섹션 위에 올라오면 흰색 → 검정으로 전환합니다. */
  const brand = document.querySelector(".site-brand");
  const lightSection = document.querySelector("[data-light-section]");
  if (!brand || !lightSection) return;

  let ticking = false;

  const updateBrandTheme = () => {
    ticking = false;
    const sectionRect = lightSection.getBoundingClientRect();
    const brandRect = brand.getBoundingClientRect();
    const brandY = brandRect.top + brandRect.height * 0.5;
    const onLight = sectionRect.top <= brandY && sectionRect.bottom > brandY;
    brand.classList.toggle("is-on-light", onLight);
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateBrandTheme);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
  requestUpdate();
})();
