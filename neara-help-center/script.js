const helpSearchInput = document.getElementById("help-search");
const searchEmptyState = document.getElementById("search-empty");
const searchableCards = document.querySelectorAll(
  ".quick-link-card, .help-card, .video-card, .faq-item, .contact-item",
);

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function runHelpSearch(query) {
  const normalizedQuery = normalizeText(query);
  let visibleCount = 0;

  searchableCards.forEach((card) => {
    const content = normalizeText(card.textContent);
    const keywords = normalizeText(card.getAttribute("data-keywords"));
    const isMatch =
      normalizedQuery.length === 0 ||
      content.includes(normalizedQuery) ||
      keywords.includes(normalizedQuery);

    card.hidden = !isMatch;
    if (isMatch) {
      visibleCount += 1;
    }
  });

  if (searchEmptyState) {
    searchEmptyState.hidden = visibleCount > 0 || normalizedQuery.length === 0;
  }
}

if (helpSearchInput) {
  helpSearchInput.addEventListener("input", (event) => {
    runHelpSearch(event.target.value);
  });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");

    if (!targetId || targetId === "#") {
      return;
    }

    const target = document.querySelector(targetId);
    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelectorAll(".faq-item").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) {
      return;
    }

    document.querySelectorAll(".faq-item").forEach((otherItem) => {
      if (otherItem !== item) {
        otherItem.open = false;
      }
    });
  });
});

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -60px 0px",
    },
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
