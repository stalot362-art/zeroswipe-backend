<!DOCTYPE html>
<html>
<head>
  <title>ZeroSwipe</title>
  <script src="https://js.paystack.co/v1/inline.js"></script>

  <style>
    body {
      font-family: Arial;
      text-align: center;
      background: #0f172a;
      color: white;
    }

    button {
      padding: 12px 20px;
      margin: 10px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
    }

    #matchBtn { background: #22c55e; }
    #unmatchBtn { background: #ef4444; }
    #payBtn { background: #3b82f6; }

    video {
      width: 300px;
      margin: 10px;
      border-radius: 10px;
    }

    #status {
      margin-top: 10px;
    }

    /* MODAL */
    #modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      justify-content: center;
      align-items: center;
    }

    #modalContent {
      background: #1e293b;
      padding: 20px;
      border-radius: 12px;
      max-width: 350px;
      text-align: center;
    }

    #modalMessage {
      color: #60a5fa;
      font-size: 18px;
      margin-bottom: 20px;
    }

    #stayBtn {
      background: #22c55e;
    }

    #confirmUnmatchBtn {
      background: #ef4444;
    }
  </style>
</head>

<body>

<h1>ZeroSwipe</h1>

<video id="localVideo" autoplay muted></video>
<video id="remoteVideo" autoplay></video>

<br>

<button id="matchBtn">Get Match</button>
<button id="unmatchBtn">Unmatch ($1)</button>
<button id="payBtn">Pay $1</button>

<p id="status"></p>

<!-- MODAL -->
<div id="modal">
  <div id="modalContent">
    <p id="modalMessage">
      A few more minutes could change everything.  
      Most meaningful connections take a little longer to reveal themselves.
    </p>

    <button id="stayBtn">Stay a little longer</button>
    <button id="confirmUnmatchBtn">Continue to Unmatch</button>
  </div>
</div>

<script>
const BACKEND = "https://your-backend-url.onrender.com";

// ✅ persistent user ID
let userId = localStorage.getItem("userId");
if (!userId) {
  userId = "user_" + Math.random().toString(36).substring(7);
  localStorage.setItem("userId", userId);
}

let reference = "";

// ================= MATCH =================
document.getElementById("matchBtn").onclick = async () => {
  const res = await fetch(BACKEND + "/match", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ userId })
  });

  const data = await res.json();

  if (data.error) {
    document.getElementById("status").innerText = data.error;
  } else {
    document.getElementById("status").innerText = "You got a match!";
  }
};

// ================= OPEN MODAL INSTEAD =================
document.getElementById("unmatchBtn").onclick = () => {
  document.getElementById("modal").style.display = "flex";
};

// ================= STAY BUTTON =================
document.getElementById("stayBtn").onclick = () => {
  document.getElementById("modal").style.display = "none";
};

// ================= CONFIRM UNMATCH =================
document.getElementById("confirmUnmatchBtn").onclick = async () => {

  await fetch(BACKEND + "/unmatch", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ userId })
  });

  document.getElementById("modal").style.display = "none";
  document.getElementById("status").innerText =
    "You unmatched. Pay $1 to continue.";
};

// ================= PAYMENT =================
document.getElementById("payBtn").onclick = () => {

  const handler = PaystackPop.setup({
    key: "pk_test_xxxxxxxxx", // 🔁 REPLACE WITH YOUR KEY
    email: "test@email.com",
    amount: 100,
    currency: "USD",

    callback: function(response) {
      reference = response.reference;
      verifyPayment();
    },

    onClose: function() {
      alert("Payment cancelled");
    }
  });

  handler.openIframe();
};

// ================= VERIFY PAYMENT =================
async function verifyPayment() {
  const res = await fetch(BACKEND + "/pay", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      userId: userId,
      reference: reference
    })
  });

  const data = await res.json();

  if (data.message) {
    document.getElementById("status").innerText = data.message;
    document.getElementById("modal").style.display = "none";
  } else {
    document.getElementById("status").innerText = "Server update failed";
  }
}

</script>

</body>
</html>
