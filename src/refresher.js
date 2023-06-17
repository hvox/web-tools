document.addEventListener("DOMContentLoaded", _ => {
	// TODO: fix wrong scroll on page reaload
	const scroll = sessionStorage.getItem("scroll");
	sessionStorage.removeItem("\'scroll");
	if (scroll) window.scrollTo(0, scroll);
});
// TODO: move fetch into DOMContentLoaded handler
fetch("WAITREQUEST").then(_ => {
	sessionStorage.setItem("scroll", window.scrollY);
	location.reload();
}, error => {
	console.error("ERROR:", error);
});
