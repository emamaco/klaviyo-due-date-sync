const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

app.post("/api/sync-due-date", async (req, res) => {
  const { email, due_date } = req.body;
  if (!email || !due_date) return res.status(400).json({ error: "Missing email or due_date" });

  try {
    // Lookup customer by email
    const customerResp = await axios.get(`https://${process.env.SHOP}.myshopify.com/admin/api/2023-10/customers/search.json?query=email:${email}`, {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
      },
    });

    const customer = customerResp.data.customers[0];
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    // Update metafields
    const metafields = [
      {
        namespace: "journey",
        key: "due_date",
        value: due_date,
        type: "date",
      },
      {
        namespace: "journey",
        key: "due_date_type",
        value: "manual",
        type: "single_line_text_field",
      },
    ];

    await Promise.all(metafields.map((mf) =>
      axios.post(`https://${process.env.SHOP}.myshopify.com/admin/api/2023-10/customers/${customer.id}/metafields.json`, {
        metafield: mf,
      }, {
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
      })
    ));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
