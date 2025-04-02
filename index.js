const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

app.post("/api/sync-due-date", async (req, res) => {
  const { email, due_date } = req.body;
  if (!email || !due_date) return res.status(400).json({ error: "Missing email or due_date" });

  const parseKlaviyoDate = (input) => {
    const parts = input.split("/");
    if (parts.length !== 3) return null;
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const cleanDate = parseKlaviyoDate(due_date);
  if (!cleanDate) {
    console.log("Invalid date format from Klaviyo:", due_date);
    return res.status(400).json({ error: "Invalid due date format" });
  }

  try {
    // Lookup customer by email
    const customerResp = await axios.get(`https://${process.env.SHOP}.myshopify.com/admin/api/2023-10/customers/search.json?query=email:${email}`, {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
      },
    });

    let customer = customerResp.data.customers[0];

    if (!customer) {
      console.log("Customer not found, creating new:", email);

      const createResp = await axios.post(`https://${process.env.SHOP}.myshopify.com/admin/api/2023-10/customers.json`, {
        customer: {
          email: email,
          tags: "klaviyo-auto-created",
          metafields: [
            {
              namespace: "journey",
              key: "due_date",
              value: cleanDate,
              type: "date"
            },
            {
              namespace: "journey",
              key: "due_date_type",
              value: "manual",
              type: "single_line_text_field"
            }
          ]
        }
      }, {
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
          "Content-Type": "application/json"
        }
      });

      console.log("New customer created:", createResp.data.customer.id);
      return res.status(200).json({ success: true, customer_created: true });
    }

    console.log("Found customer ID:", customer.id);

    // Update metafields
    const metafields = [
      {
        namespace: "journey",
        key: "due_date",
        value: cleanDate,
        type: "date",
      },
      {
        namespace: "journey",
        key: "due_date_type",
        value: "manual",
        type: "single_line_text_field",
      },
    ];

    const results = await Promise.all(metafields.map((mf) =>
      axios.post(`https://${process.env.SHOP}.myshopify.com/admin/api/2023-10/customers/${customer.id}/metafields.json`, {
        metafield: mf,
      }, {
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
      })
    ));

    console.log("Metafields updated:", results.map(r => r.data));
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Webhook error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
