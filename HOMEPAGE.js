const soundToggle = document.querySelector(".sound-toggle");
const musicPlayer = document.querySelector("#music-player");
const sectionAudio = musicPlayer?.querySelector("#section-audio");
const sectionTracks = {
	"page-one": {
		page: "HOMEPAGE.html",
		label: "SECTION ONE / TRACK 01",
		source: "SECTION%201.mp3",
	},
	"page-two": {
		page: "SECTION-II.html",
		label: "SECTION TWO / TRACK 02",
		source: "SECTION%202.mp3",
	},
	"page-three": {
		page: "SECTION-III.html",
		label: "SECTION THREE / TRACK 03",
		source: "SECTION%203.mp3",
	},
	"page-four": {
		page: "SECTION-IV.html",
		label: "SECTION FOUR / TRACK 04",
		source: "SECTION%204.mp3",
	},
	"page-five": {
		page: "SECTION-V.html",
		label: "SECTION FIVE / TRACK 05",
		source: "SECTION%205.mp3",
	},
};
const musicPreferenceKey = "mk-audio-enabled";
const reducedMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const transitionDuration = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--level-switch-duration")) || 1100;
const localSiteOrigin = "http://localhost:8765";
const isFilePreview = window.location.protocol === "file:";
let soundEnabled = true;
let navigationInProgress = false;
let pendingHistoryDestination;
let pendingNavigationDestination;
let localServerReady = false;
let localServerProbeActive = false;
let requestedLocalPage;

try {
	const savedPreference = localStorage.getItem(musicPreferenceKey);
	if (savedPreference !== null) soundEnabled = savedPreference === "on";
} catch {
	// The playlist remains available even when browser storage is restricted.
}

function getCurrentTrack() {
	return sectionTracks[Object.keys(sectionTracks).find((pageClass) => document.body.classList.contains(pageClass))] || sectionTracks["page-one"];
}

function updateTrackDetails(track = getCurrentTrack()) {
	const trackLabel = musicPlayer?.querySelector(".track-label");
	const audioLink = musicPlayer?.querySelector(".audio-file-link");
	const audioSource = sectionAudio?.querySelector("source");
	if (trackLabel) trackLabel.textContent = track.label;
	if (audioLink) audioLink.href = track.source;
	if (sectionAudio) {
		sectionAudio.setAttribute("aria-label", `${track.label.toLowerCase()} music`);
		sectionAudio.loop = true;
		sectionAudio.autoplay = true;
	}
	if (audioSource && audioSource.getAttribute("src") !== track.source) {
		audioSource.src = track.source;
		sectionAudio.load();
	}
	musicPlayer?.setAttribute("aria-hidden", "true");
}

function loadSectionTrack(track = getCurrentTrack(), requestPlayback = soundEnabled) {
	updateTrackDetails(track);
	if (!sectionAudio) return;
	if (requestPlayback && soundEnabled) sectionAudio.play().catch(() => {});
	else sectionAudio.pause();
}

function updateSoundControl() {
	if (!soundToggle || !musicPlayer || !sectionAudio) return;

	soundToggle.setAttribute("aria-pressed", String(soundEnabled));
	soundToggle.setAttribute("aria-label", soundEnabled ? "I-off ang music" : "I-on ang music");
	soundToggle.title = soundEnabled ? "I-off ang music" : "I-on ang music";
	soundToggle.querySelector(".sound-label").textContent = soundEnabled ? "MUSIC ON" : "MUSIC OFF";
	musicPlayer.hidden = !soundEnabled;
	updateTrackDetails();
	if (soundEnabled) sectionAudio.play().catch(() => {});
	else sectionAudio.pause();
}

soundToggle?.addEventListener("click", () => {
	if (soundEnabled && sectionAudio?.paused) {
		sectionAudio.play().catch(() => {});
		return;
	}
	soundEnabled = !soundEnabled;
	try {
		localStorage.setItem(musicPreferenceKey, soundEnabled ? "on" : "off");
	} catch {
		// Keep the current-page toggle usable when browser storage is restricted.
	}
	updateSoundControl();
});

updateSoundControl();

function wait(milliseconds) {
	return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function loadStylesheet(href) {
	return new Promise((resolve, reject) => {
		const stylesheet = document.createElement("link");
		stylesheet.rel = "stylesheet";
		stylesheet.href = href;
		stylesheet.addEventListener("load", () => resolve(stylesheet), { once: true });
		stylesheet.addEventListener("error", () => {
			stylesheet.remove();
			reject(new Error("Could not load the section styles."));
		}, { once: true });
		document.head.append(stylesheet);
	});
}

function updateActiveSection(destination) {
	document.querySelectorAll(".nav-link").forEach((link) => {
		const isCurrent = new URL(link.href, window.location.href).pathname === destination.pathname;
		link.classList.toggle("is-active", isCurrent);
		if (isCurrent) link.setAttribute("aria-current", "page");
		else link.removeAttribute("aria-current");
	});
}

function showLocalServerNotice() {
	if (document.querySelector(".file-server-notice")) return;
	const notice = document.createElement("aside");
	notice.className = "file-server-notice";
	notice.setAttribute("role", "status");
	notice.innerHTML = `Para tuloy ang MP3 sa pagitan ng mga seksiyon, buksan ang aralin sa <a href="${localSiteOrigin}/HOMEPAGE.html">local site</a>.`;
	document.body.append(notice);
}

function routeFilePreviewToServer(pageName) {
	if (!/^HOMEPAGE\.html$|^SECTION-(II|III|IV|V)\.html$/.test(pageName)) return;
	requestedLocalPage = pageName;
	if (localServerReady) {
		window.location.assign(`${localSiteOrigin}/${encodeURIComponent(requestedLocalPage)}`);
		return;
	}
	if (localServerProbeActive) return;

	localServerProbeActive = true;
	const probe = document.createElement("script");
	probe.src = `${localSiteOrigin}/server-check.js`;
	probe.addEventListener("load", () => {
		localServerReady = true;
		localServerProbeActive = false;
		window.location.replace(`${localSiteOrigin}/${encodeURIComponent(requestedLocalPage)}`);
	}, { once: true });
	probe.addEventListener("error", () => {
		localServerProbeActive = false;
		showLocalServerNotice();
	}, { once: true });
	document.head.append(probe);
}

async function navigateToSection(destination, addHistory = true) {
	if (navigationInProgress) {
		pendingNavigationDestination = destination;
		return;
	}
	navigationInProgress = true;
	const shouldAnimate = !reducedMotionPreference.matches;
	let transition;
	let incomingStylesheet;

	if (shouldAnimate) {
		document.body.classList.add("is-switching");
		transition = document.createElement("div");
		transition.className = "level-transition";
		transition.setAttribute("aria-hidden", "true");
		const label = document.createElement("span");
		label.className = "level-transition__label";
		label.textContent = "LEVEL SHIFT";
		transition.append(label);
		document.body.append(transition);
	}

	try {
		const responsePromise = fetch(destination.href, { headers: { Accept: "text/html" } });
		const transitionPromise = wait(shouldAnimate ? transitionDuration : 0);
		const [response] = await Promise.all([responsePromise, transitionPromise]);
		if (!response.ok) throw new Error("Could not load the next lesson section.");

		const incomingDocument = new DOMParser().parseFromString(await response.text(), "text/html");
		const incomingMain = incomingDocument.querySelector("main.lesson-page");
		const incomingFooter = incomingDocument.querySelector(".page-footer");
		const stylesheetLink = incomingDocument.querySelector('link[href^="section-"]');
		if (!incomingMain || !incomingFooter || !stylesheetLink) throw new Error("The destination page is missing lesson content.");

		const stylesheetUrl = new URL(stylesheetLink.getAttribute("href"), destination.href);
		incomingStylesheet = await loadStylesheet(stylesheetUrl.href);
		const currentMain = document.querySelector("main.lesson-page");
		const currentFooter = document.querySelector(".page-footer");
		const currentStylesheet = document.querySelector('link[href*="section-"][rel="stylesheet"]');
		const nextMain = document.importNode(incomingMain, true);
		const nextFooter = document.importNode(incomingFooter, true);
		const pageClass = [...incomingDocument.body.classList].find((className) => /^page-/.test(className));

		currentMain.replaceWith(nextMain);
		currentFooter.replaceWith(nextFooter);
		document.body.className = pageClass || "";
		if (shouldAnimate) document.body.classList.add("is-arriving");
		loadSectionTrack();
		document.title = incomingDocument.title;
		document.documentElement.lang = incomingDocument.documentElement.lang;
		const nextDescription = incomingDocument.querySelector('meta[name="description"]')?.content;
		if (nextDescription) document.querySelector('meta[name="description"]').content = nextDescription;
		const nextTheme = incomingDocument.querySelector('meta[name="theme-color"]')?.content;
		if (nextTheme) document.querySelector('meta[name="theme-color"]').content = nextTheme;
		if (addHistory) history.pushState({}, "", destination.href);
		updateActiveSection(destination);
		currentStylesheet.remove();
		transition?.remove();
		window.scrollTo(0, 0);
		const heading = nextMain.querySelector("h1");
		heading?.setAttribute("tabindex", "-1");
		heading?.focus({ preventScroll: true });
	} catch {
		transition?.remove();
		incomingStylesheet?.remove();
		pendingHistoryDestination = undefined;
		window.location.assign(destination.href);
		return;
	} finally {
		navigationInProgress = false;
		if (pendingHistoryDestination) {
			const queuedDestination = pendingHistoryDestination;
			pendingHistoryDestination = undefined;
			pendingNavigationDestination = undefined;
			void navigateToSection(queuedDestination, false);
		} else if (pendingNavigationDestination) {
			const queuedDestination = pendingNavigationDestination;
			pendingNavigationDestination = undefined;
			void navigateToSection(queuedDestination);
		}
	}
}

document.addEventListener("click", (event) => {
	if (!(event.target instanceof Element)) return;
	const link = event.target.closest('a[href$=".html"]');
	if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;

	const destination = new URL(link.href, window.location.href);
	if (isFilePreview && destination.protocol === "file:") {
		event.preventDefault();
		routeFilePreviewToServer(decodeURIComponent(destination.pathname.split(/[\\/]/).pop()));
		return;
	}
	if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
	event.preventDefault();
	const destinationPage = decodeURIComponent(destination.pathname.split("/").pop());
	const nextTrack = Object.values(sectionTracks).find((track) => track.page === destinationPage);
	if (nextTrack) loadSectionTrack(nextTrack);
	void navigateToSection(destination);
});

window.addEventListener("popstate", () => {
	const destination = new URL(window.location.href);
	if (navigationInProgress) {
		pendingHistoryDestination = destination;
		pendingNavigationDestination = undefined;
		return;
	}
	void navigateToSection(destination, false);
});

if (isFilePreview) {
	routeFilePreviewToServer(decodeURIComponent(window.location.pathname.split(/[\\/]/).pop()));
}