"use strict";

const THEME_KEY = "kirilic-theme";
const MOTION_KEY = "kirilic-reduced-motion";

const create = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
};

const normalizeMedia = (item) => {
    const value = item.media ?? item.media_path;
    const media = Array.isArray(value) ? value : [value];
    return media.filter((source) => typeof source === "string" && source.trim());
};

const createTextContent = (text) => {
    const fragment = document.createDocumentFragment();
    const paragraphs = String(text ?? "").replace(/\\n/g, "\n").split(/\n{2,}/);

    paragraphs.filter(Boolean).forEach((paragraph) => {
        const node = create("p");
        paragraph.split("\n").forEach((line, index) => {
            if (index) node.append(document.createElement("br"));
            node.append(document.createTextNode(line));
        });
        fragment.append(node);
    });

    return fragment;
};

const createGallery = (sources, alt) => {
    if (!sources.length) return null;

    const gallery = create("div", `post-gallery${sources.length === 1 ? " single-image" : ""}`);
    sources.forEach((source) => {
        const image = create("img");
        image.src = source;
        image.alt = alt;
        image.loading = "lazy";
        image.decoding = "async";
        gallery.append(image);
    });
    return gallery;
};

const createPost = (item, imageAlt) => {
    const article = create("article", "post glass-box tech-corners");
    const header = create("header", "post-header");
    header.append(create("h2", "post-title", item.title || "Untitled"));
    header.append(create("time", "post-date", item.date || ""));

    const content = create("div", "post-content");
    const gallery = createGallery(normalizeMedia(item), imageAlt);
    if (gallery) content.append(gallery);
    content.append(createTextContent(item.text));
    article.append(header, content);
    return article;
};

const showMessage = (container, className, message) => {
    container.replaceChildren(create("p", className, message));
};

const loadContentFeed = async (container) => {
    const source = container.dataset.source;
    const label = container.dataset.label || "items";
    const imageAlt = container.dataset.imageAlt || "Attachment";

    try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load ${source}`);
        const items = await response.json();
        if (!Array.isArray(items)) throw new TypeError(`${source} must contain an array`);

        if (!items.length) {
            showMessage(container, "empty-state", `No ${label} found.`);
            return;
        }

        container.replaceChildren(...items.map((item) => createPost(item, imageAlt)));
    } catch (error) {
        console.error(error);
        showMessage(container, "error-state", `Could not load ${label}. Please try again later.`);
    }
};

const formatTime = (seconds) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    return `${minutes}:${String(Math.floor(safeSeconds % 60)).padStart(2, "0")}`;
};

const createTrack = (track, index, player) => {
    const item = create("button", "track-item");
    item.type = "button";
    item.dataset.trackIndex = String(index);
    item.append(
        create("span", "track-play-btn", "▶"),
        create("span", "track-number", `${index + 1}.`),
        create("span", "track-name", track.title || "Untitled"),
    );
    if (track.duration) item.append(create("span", "track-duration", track.duration));
    item.addEventListener("click", () => player.selectTrack(index, true));
    return item;
};

const createPlayer = (tracks) => {
    const safeTracks = Array.isArray(tracks) ? tracks : [];
    const wrapper = create("section", "custom-player-wrapper");
    const audio = create("audio");
    audio.preload = "metadata";

    const controls = create("div", "player-controls");
    const toggle = create("button", "player-toggle-btn", "▶ Play");
    toggle.type = "button";
    const title = create("span", "current-track-title", safeTracks[0]?.title || "No tracks available");
    controls.append(toggle, title);

    const timelineRow = create("div", "timeline-container");
    const currentTime = create("span", "time-display", "0:00");
    const timeline = create("input", "custom-timeline");
    timeline.type = "range";
    timeline.min = "0";
    timeline.max = "100";
    timeline.value = "0";
    timeline.setAttribute("aria-label", "Track progress");
    const duration = create("span", "time-display", "0:00");
    timelineRow.append(currentTime, timeline, duration);
    wrapper.append(audio, controls, timelineRow);

    let currentIndex = 0;
    const setPlayLabel = (isPlaying) => { toggle.textContent = isPlaying ? "❚❚ Pause" : "▶ Play"; };
    const updateTrackState = () => {
        wrapper.closest(".album-card")?.querySelectorAll(".track-item").forEach((item) => {
            item.setAttribute("aria-current", String(Number(item.dataset.trackIndex) === currentIndex));
        });
    };
    const pauseOtherPlayers = () => document.querySelectorAll("audio").forEach((other) => {
        if (other !== audio) {
            other.pause();
            const otherToggle = other.closest(".custom-player-wrapper")?.querySelector(".player-toggle-btn");
            if (otherToggle) otherToggle.textContent = "▶ Play";
        }
    });
    const selectTrack = (index, shouldPlay) => {
        const track = safeTracks[index];
        if (!track) return;
        currentIndex = index;
        audio.src = track.audio_url || "";
        title.textContent = track.title || "Untitled";
        timeline.value = "0";
        currentTime.textContent = "0:00";
        updateTrackState();
        if (shouldPlay && audio.src) {
            pauseOtherPlayers();
            audio.play().then(() => setPlayLabel(true)).catch((error) => console.warn("Playback failed", error));
        }
    };

    toggle.addEventListener("click", () => {
        if (!safeTracks.length) return;
        if (!audio.src) selectTrack(currentIndex, false);
        if (audio.paused) {
            pauseOtherPlayers();
            audio.play().then(() => setPlayLabel(true)).catch((error) => console.warn("Playback failed", error));
        } else {
            audio.pause();
        }
    });
    timeline.addEventListener("input", () => {
        if (audio.duration) audio.currentTime = (Number(timeline.value) / 100) * audio.duration;
    });
    audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        timeline.value = String((audio.currentTime / audio.duration) * 100);
        currentTime.textContent = formatTime(audio.currentTime);
    });
    audio.addEventListener("loadedmetadata", () => { duration.textContent = formatTime(audio.duration); });
    audio.addEventListener("play", () => setPlayLabel(true));
    audio.addEventListener("pause", () => setPlayLabel(false));
    audio.addEventListener("ended", () => {
        if (currentIndex + 1 < safeTracks.length) selectTrack(currentIndex + 1, true);
    });

    return { wrapper, selectTrack, createTrack: (track, index) => createTrack(track, index, { selectTrack }) };
};

const createAlbum = (album) => {
    const tracks = Array.isArray(album.tracks) ? album.tracks : [];
    const card = create("article", "album-card glass-box tech-corners");
    const header = create("header", "album-header");
    const coverWrapper = create("div", "album-cover-wrapper");
    const cover = create("img", "album-cover");
    cover.src = album.cover || "assets/banner.png";
    cover.alt = `${album.title || "Album"} cover`;
    cover.loading = "lazy";
    cover.addEventListener("error", () => { cover.src = "assets/banner.png"; }, { once: true });
    coverWrapper.append(cover);
    const info = create("div", "album-info");
    info.append(create("h2", "album-title", album.title || "Untitled"));
    info.append(create("p", "album-meta", [album.type, album.release_date].filter(Boolean).join(" • ")));
    header.append(coverWrapper, info);

    const player = createPlayer(tracks);
    const trackList = create("div", "tracks-list");
    tracks.forEach((track, index) => trackList.append(player.createTrack(track, index)));
    card.append(header, player.wrapper, trackList);
    return card;
};

const loadAlbums = async (container) => {
    try {
        const response = await fetch(container.dataset.source, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load ${container.dataset.source}`);
        const albums = await response.json();
        if (!Array.isArray(albums)) throw new TypeError("albums.json must contain an array");
        if (!albums.length) return showMessage(container, "empty-state", "No albums found.");
        container.replaceChildren(...albums.map(createAlbum));
    } catch (error) {
        console.error(error);
        showMessage(container, "error-state", "Could not load albums. Please try again later.");
    }
};

const setupModal = () => {
    const modal = document.querySelector("#image-modal");
    if (!modal) return;
    const image = modal.querySelector("img");
    const close = () => {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        image.removeAttribute("src");
    };

    document.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof HTMLImageElement && target.closest(".post-gallery")) {
            image.src = target.currentSrc || target.src;
            image.alt = target.alt;
            modal.classList.add("active");
            modal.setAttribute("aria-hidden", "false");
            modal.querySelector("button")?.focus();
        }
    });
    modal.addEventListener("click", (event) => { if (event.target === modal || event.target.closest("[data-modal-close]")) close(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal.classList.contains("active")) close(); });
};

const setupTheme = () => {
    const button = document.querySelector("#theme-toggle");
    if (!button) return;
    const applyTheme = (theme) => {
        document.documentElement.dataset.theme = theme;
        button.setAttribute("aria-pressed", String(theme === "light"));
        button.textContent = theme === "light" ? "☾ Dark theme" : "☀ Light theme";
    };
    const savedTheme = localStorage.getItem(THEME_KEY);
    applyTheme(savedTheme === "light" ? "light" : "dark");
    button.addEventListener("click", () => {
        const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
        localStorage.setItem(THEME_KEY, nextTheme);
        applyTheme(nextTheme);
    });
};

const setupMotion = () => {
    const button = document.querySelector("#motion-toggle");
    if (!button) return;

    const applyMotion = (reduced) => {
        document.documentElement.dataset.motion = reduced ? "reduced" : "full";
        button.setAttribute("aria-pressed", String(reduced));
        button.textContent = reduced ? "Enable animations" : "Disable animations";
    };

    const savedPreference = localStorage.getItem(MOTION_KEY);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let reduced = savedPreference === null ? prefersReducedMotion : savedPreference === "true";
    applyMotion(reduced);

    button.addEventListener("click", () => {
        reduced = !reduced;
        localStorage.setItem(MOTION_KEY, String(reduced));
        applyMotion(reduced);
    });
};

document.addEventListener("DOMContentLoaded", () => {
    setupTheme();
    setupMotion();
    setupModal();
    document.querySelectorAll("[data-feed]").forEach(loadContentFeed);
    document.querySelectorAll("[data-albums]").forEach(loadAlbums);
});
