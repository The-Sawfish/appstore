// ==========================================================
// SAWFISH APP STORE — MAIN SCRIPT
// Handles: expanded views, comments, ratings, Firebase
// ==========================================================

// -------------------- FIREBASE SETUP --------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5JaGq3ezv1ghif7ggRr8_jxuq7ZGw4Bo",
  authDomain: "appstore-cb2fa.firebaseapp.com",
  projectId: "appstore-cb2fa",
  storageBucket: "appstore-cb2fa.firebasestorage.app",
  messagingSenderId: "122307463006",
  appId: "1:122307463006:web:25993ed888531908fbb1cf"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// -------------------- EXPANDED VIEW HANDLING --------------------
const expandedContainer = document.getElementById("expanded-views");

function openExpanded(appId) {
    const appCard = document.querySelector(`[data-app-id="${appId}"]`);
    const cloned = appCard.cloneNode(true);

    // Remove previous expanded content
    expandedContainer.innerHTML = "";

    // Create expanded wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "expanded-app";

    // Build expanded header
    const header = document.createElement("div");
    header.className = "expanded-header";
    const img = document.createElement("img");
    img.src = appCard.dataset.icon; // Icon path
    header.appendChild(img);

    const titleCol = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = appCard.dataset.name;
    const dev = document.createElement("div");
    dev.className = "developer";
    dev.textContent = `Developer: ${appCard.dataset.dev}`;
    const category = document.createElement("div");
    category.className = "category";
    category.textContent = `Category: ${appCard.dataset.category}`;

    titleCol.appendChild(title);
    titleCol.appendChild(dev);
    titleCol.appendChild(category);
    header.appendChild(titleCol);

    wrapper.appendChild(header);

    // Description
    const summary = document.createElement("div");
    summary.className = "expanded-summary";
    summary.textContent = appCard.dataset.brief;
    wrapper.appendChild(summary);

    const description = document.createElement("div");
    description.className = "expanded-description";
    description.innerHTML = appCard.dataset.longdesc;
    wrapper.appendChild(description);

    // Actions (open app / link)
    const actions = document.createElement("div");
    actions.className = "expanded-actions";
    const link = document.createElement("a");
    link.href = appCard.dataset.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open App";
    actions.appendChild(link);
    wrapper.appendChild(actions);

    // Ratings
    const ratings = document.createElement("div");
    ratings.className = "expanded-ratings";
    const ratingTitle = document.createElement("h3");
    ratingTitle.textContent = "Average Rating:";
    ratings.appendChild(ratingTitle);

    const ratingValue = document.createElement("span");
    ratingValue.textContent = "Loading…";
    ratingValue.id = "avg-rating";
    ratings.appendChild(ratingValue);
    wrapper.appendChild(ratings);

    // Comments
    const commentsSection = document.createElement("div");
    commentsSection.className = "expanded-comments";
    const commentsTitle = document.createElement("h3");
    commentsTitle.textContent = "Comments:";
    commentsSection.appendChild(commentsTitle);

    const commentList = document.createElement("div");
    commentList.className = "comment-list";
    commentsSection.appendChild(commentList);

    // Comment form
    const form = document.createElement("div");
    form.className = "comment-form";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Write your comment here…";

    const ratingSelect = document.createElement("select");
    [1,2,3,4,5].forEach(n => {
        const option = document.createElement("option");
        option.value = n;
        option.textContent = `${n} Star${n > 1 ? "s" : ""}`;
        ratingSelect.appendChild(option);
    });

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Submit";

    form.appendChild(textarea);
    form.appendChild(ratingSelect);
    form.appendChild(submitBtn);
    commentsSection.appendChild(form);

    wrapper.appendChild(commentsSection);

    expandedContainer.appendChild(wrapper);
    expandedContainer.classList.add("visible");

    // Load comments and rating from Firebase
    loadComments(appId, commentList, ratingValue);

    // Handle submit
    submitBtn.onclick = async () => {
        const text = textarea.value.trim();
        const rating = parseInt(ratingSelect.value);

        if (!text) return alert("Please write a comment.");

        await addDoc(collection(db, "app-comments"), {
            appId,
            comment: text,
            rating,
            timestamp: Date.now()
        });

        textarea.value = "";
        loadComments(appId, commentList, ratingValue);
    };
}

// Close expanded on outside click
expandedContainer.addEventListener("click", e => {
    if (e.target === expandedContainer) {
        expandedContainer.classList.remove("visible");
    }
});

// -------------------- LOAD COMMENTS & AVG RATING --------------------
async function loadComments(appId, commentListEl, ratingEl) {
    const q = query(
        collection(db, "app-comments"),
        where("appId", "==", appId),
        orderBy("timestamp", "desc")
    );

    const snapshot = await getDocs(q);
    commentListEl.innerHTML = "";

    let sum = 0;
    let count = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        sum += data.rating;
        count++;

        const div = document.createElement("div");
        div.className = "comment";
        div.innerHTML = `<strong>${data.rating} Star${data.rating>1?"s":""}</strong>${data.comment}`;
        commentListEl.appendChild(div);
    });

    ratingEl.textContent = count ? (sum/count).toFixed(1) + " / 5" : "No ratings yet";
}

// -------------------- CARD CLICK LISTENERS --------------------
document.querySelectorAll(".app-card, .game-card, .connect-card, .os-card").forEach(card => {
    card.addEventListener("click", () => {
        const appId = card.dataset.appId;
        openExpanded(appId);
    });
});

// -------------------- OS IFRAME PREVIEWS --------------------
document.querySelectorAll('.os-container iframe').forEach(iframe => {
    iframe.addEventListener('load', () => {
        const overlay = iframe.parentElement.querySelector('.overlay');
        if (overlay) overlay.classList.add('visible');
    });
});
