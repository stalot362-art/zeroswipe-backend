app.post("/pay", async (req, res) => {
  const { userId, reference } = req.body;

  console.log("=== PAYMENT START ===");
  console.log("User:", userId);
  console.log("Reference:", reference);
  console.log("Secret Key:", process.env.PAYSTACK_SECRET_KEY);

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    console.log("FULL PAYSTACK RESPONSE:");
    console.log(JSON.stringify(response.data, null, 2));

    const data = response?.data?.data;

    if (!data) {
      throw new Error("No data returned from Paystack");
    }

    if (data.status === "success") {

      if (!users[userId]) {
        users[userId] = {
          unmatched: 0,
          mustPay: false
        };
      }

      users[userId].mustPay = false;

      console.log("✅ PAYMENT SUCCESS → USER UNLOCKED");

      return res.json({
        message: "Payment verified and unlocked"
      });

    } else {
      console.log("❌ Payment not successful:", data.status);

      return res.status(400).json({
        error: "Payment not successful"
      });
    }

  } catch (err) {
    console.log("❌ PAYMENT ERROR DETAILS:");

    if (err.response) {
      console.log("Status:", err.response.status);
      console.log("Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.log("Error:", err.message);
    }

    return res.status(500).json({
      error: "Server update failed"
    });
  }
});
