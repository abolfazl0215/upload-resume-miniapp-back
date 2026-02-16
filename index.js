require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const TelegramBot = require("node-telegram-bot-api");

// ==================== CONFIGURATION ====================
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cloudinary Configuration
cloudinary.config({
  cloud_name: "dtakyi9mf",
  api_key: "588183267814191",
  api_secret: "pX-FbXATvi7couH36CFWn_PURf4",
  secure: true,
});

// Multer Storage Configuration for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "worker-submissions",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      { width: 1200, height: 1200, crop: "limit" },
      { quality: "auto:good" },
    ],
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 6,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("فقط فایل‌های تصویری مجاز هستند"), false);
    }
    cb(null, true);
  },
});

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN =
  "8115694341:AAFMtHNQ5AXNYcYNSikmPaM-Nm0ENeLthds";
const MINI_APP_URL = "https://upload-resume-miniapp.vercel.app";
const GROUP_INVITE_LINK = "https://t.me/armenia_with_abolfazl";
const GROUP_NAME = "دورهمی ایرانیان ارمنستان";

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Store user join times
const userJoinTimes = new Map();

// ==================== MONGODB MODELS ====================

// Worker Schema
const workerSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      index: true,
    },
    telegramUsername: {
      type: String,
      default: "",
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 18,
      max: 70,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    whatsapp: {
      type: String,
      default: "",
      trim: true,
    },
    region: {
      type: String,
      default: "",
      trim: true,
    },
    district: {
      type: String,
      default: "",
      trim: true,
    },
    specialty: {
      type: String,
      required: true,
      trim: true,
    },
    experience: {
      type: String,
      required: true,
      enum: [
        "beginner",
        "junior",
        "intermediate",
        "senior",
        "expert",
      ],
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    currentlyInArmenia: {
      type: String,
      required: true,
      enum: ["yes", "no"],
      default: "yes",
    },
    images: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

workerSchema.index({ telegramId: 1, submittedAt: -1 });
workerSchema.index({ specialty: 1 });
workerSchema.index({ region: 1 });
workerSchema.index({ status: 1 });

const Worker = mongoose.model("Worker", workerSchema);

// Submission Limit Schema (for rate limiting)
const submissionLimitSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastSubmission: {
      type: Date,
      required: true,
      default: Date.now,
    },
    submissionCount: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);

// TTL index - automatically delete after 10 minutes
submissionLimitSchema.index(
  { lastSubmission: 1 },
  { expireAfterSeconds: 600 },
);

const SubmissionLimit = mongoose.model(
  "SubmissionLimit",
  submissionLimitSchema,
);

// ==================== MONGODB CONNECTION ====================
mongoose
  .connect(
    "mongodb+srv://xchat:Abolfazl021_@db1.6qsnqns.mongodb.net/?appName=db1",
  )
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ==================== TELEGRAM BOT HANDLERS ====================

// Bot Start Command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || "کاربر";

  // Record join time
  if (!userJoinTimes.has(chatId)) {
    userJoinTimes.set(chatId, Date.now());

    // Send group invite after 10 minutes
    setTimeout(
      () => {
        bot
          .sendMessage(
            chatId,
            `🎉 سلام ${userName} عزیز!\n\n` +
              `برای ارتباط بیشتر و دسترسی به اطلاعات بیشتر، به گروه ما بپیوندید:\n\n` +
              `📱 ${GROUP_NAME}\n\n` +
              `👇 برای عضویت روی لینک زیر کلیک کنید:\n${GROUP_INVITE_LINK}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "📱 عضویت در گروه",
                      url: GROUP_INVITE_LINK,
                    },
                  ],
                ],
              },
            },
          )
          .catch((err) =>
            console.error("Error sending group invite:", err),
          );
      },
      10 * 60 * 1000,
    ); // 10 minutes

    console.log(`✅ User ${chatId} joined. Group invite scheduled.`);
  }

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "📝 ثبت‌نام نیروی کار",
          web_app: { url: MINI_APP_URL },
        },
      ],
    ],
  };

  bot
    .sendMessage(
      chatId,
      `سلام ${userName} عزیز! 👋\n\n` +
        `به ربات ابوالفضل مختاری خوش آمدید.\n\n` +
        `برای ثبت‌نام به عنوان نیروی کار و دریافت فرصت‌های شغلی در ارمنستان، روی دکمه زیر کلیک کنید:\n\n` +
        `✅ پس از 2 ماه کارکرد، کارت اقامت دریافت کنید\n` +
        `💼 دسترسی به فرصت‌های شغلی متنوع\n` +
        `📱 پشتیبانی کامل`,
      { reply_markup: keyboard },
    )
    .catch((err) =>
      console.error("Error sending start message:", err),
    );
});

// Handle all other messages - redirect to Mini App
bot.on("message", (msg) => {
  // Skip if it's a command
  if (msg.text && msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "📝 باز کردن فرم ثبت‌نام",
          web_app: { url: MINI_APP_URL },
        },
      ],
    ],
  };

  bot
    .sendMessage(chatId, `لطفاً از فرم ثبت‌نام استفاده کنید:`, {
      reply_markup: keyboard,
    })
    .catch((err) =>
      console.error("Error sending redirect message:", err),
    );
});

// Error handling for bot
bot.on("polling_error", (error) => {
  console.error("❌ Telegram Bot polling error:", error);
});

console.log("🤖 Telegram Bot is active");

// ==================== MIDDLEWARE ====================

// Rate Limiter Middleware
const rateLimiter = async (req, res, next) => {
  try {
    const telegramId = req.body.telegramId;

    if (!telegramId) {
      return res.status(400).json({
        message: "شناسه تلگرام یافت نشد",
      });
    }

    // Check if user has submitted recently
    const existingLimit = await SubmissionLimit.findOne({
      telegramId,
    });

    if (existingLimit) {
      const timeSinceLastSubmission =
        Date.now() - existingLimit.lastSubmission.getTime();
      const tenMinutes = 10 * 60 * 1000;

      if (timeSinceLastSubmission < tenMinutes) {
        const remainingTime = Math.ceil(
          (tenMinutes - timeSinceLastSubmission) / 60000,
        );
        return res.status(429).json({
          message: `لطفاً ${remainingTime} دقیقه دیگر مجدداً تلاش کنید`,
          remainingMinutes: remainingTime,
        });
      }

      // Update last submission time
      existingLimit.lastSubmission = Date.now();
      existingLimit.submissionCount += 1;
      await existingLimit.save();
    } else {
      // Create new rate limit record
      await SubmissionLimit.create({
        telegramId,
        lastSubmission: Date.now(),
        submissionCount: 1,
      });
    }

    next();
  } catch (error) {
    console.error("Rate limiter error:", error);
    return res.status(500).json({
      message: "خطا در بررسی محدودیت ارسال",
    });
  }
};

// ==================== HELPER FUNCTIONS ====================

// Delete images from Cloudinary
const deleteImagesFromCloudinary = async (imageUrls) => {
  try {
    const deletePromises = imageUrls.map((url) => {
      const parts = url.split("/");
      const filename = parts[parts.length - 1];
      const publicId = `worker-submissions/${filename.split(".")[0]}`;
      return cloudinary.uploader.destroy(publicId);
    });

    await Promise.all(deletePromises);
    console.log("🗑️ Images deleted from Cloudinary");
  } catch (error) {
    console.error("Error deleting images from Cloudinary:", error);
  }
};

// ==================== API ROUTES ====================

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    mongodb:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    telegram: bot.isPolling() ? "active" : "inactive",
  });
});

// Submit Worker Form
app.post(
  "/api/workers/submit",
  rateLimiter,
  upload.array("images", 6),
  async (req, res) => {
    try {
      const {
        telegramId,
        telegramUsername,
        fullName,
        age,
        phone,
        whatsapp,
        region,
        district,
        specialty,
        experience,
        description,
        currentlyInArmenia,
      } = req.body;

      // Validation
      if (
        !telegramId ||
        !fullName ||
        !age ||
        !specialty ||
        !experience
      ) {
        return res.status(400).json({
          message: "لطفاً تمام فیلدهای الزامی را پر کنید",
        });
      }

      // Age validation
      const ageNum = parseInt(age);
      if (ageNum < 18 || ageNum > 70) {
        return res.status(400).json({
          message: "سن باید بین 18 تا 70 سال باشد",
        });
      }

      // If user is in Armenia, validate region
      if (currentlyInArmenia === "yes" && !region) {
        return res.status(400).json({
          message: "لطفاً استان خود را انتخاب کنید",
        });
      }

      // If region is Yerevan, validate district
      if (
        currentlyInArmenia === "yes" &&
        region === "Yerevan" &&
        !district
      ) {
        return res.status(400).json({
          message: "لطفاً منطقه خود را انتخاب کنید",
        });
      }

      // Image validation - only required if in Armenia
      if (
        currentlyInArmenia === "yes" &&
        (!req.files || req.files.length === 0)
      ) {
        return res.status(400).json({
          message: "لطفاً حداقل یک تصویر بارگذاری کنید",
        });
      }

      // Get image URLs from uploaded files
      const imageUrls = req.files
        ? req.files.map((file) => file.path)
        : [];

      // Create worker record
      const worker = new Worker({
        telegramId,
        telegramUsername: telegramUsername || "",
        fullName,
        age: ageNum,
        phone: phone || "",
        whatsapp: whatsapp || "",
        region: region || "",
        district: district || "",
        specialty,
        experience,
        description: description || "",
        currentlyInArmenia,
        images: imageUrls,
        status: "pending",
      });

      await worker.save();

      console.log(
        `✅ New worker submission: ${fullName} (${telegramId})`,
      );

      // Send confirmation message to user via Telegram
      try {
        await bot.sendMessage(
          telegramId,
          `✅ فرم شما با موفقیت ثبت شد!\n\n` +
            `نام: ${fullName}\n` +
            `تخصص: ${specialty}\n\n` +
            `به زودی با شما تماس خواهیم گرفت.`,
        );
      } catch (err) {
        console.error("Error sending confirmation to user:", err);
      }

      res.status(201).json({
        message: "فرم شما با موفقیت ارسال شد",
        data: {
          id: worker._id,
          fullName: worker.fullName,
          specialty: worker.specialty,
          submittedAt: worker.submittedAt,
        },
      });
    } catch (error) {
      console.error("❌ Error submitting worker:", error);

      // Delete uploaded images if worker creation failed
      if (req.files && req.files.length > 0) {
        const imageUrls = req.files.map((file) => file.path);
        await deleteImagesFromCloudinary(imageUrls);
      }

      res.status(500).json({
        message: "خطا در ارسال فرم",
        error: error.message,
      });
    }
  },
);

// Get All Workers
app.get("/api/workers", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      region,
      specialty,
      currentlyInArmenia,
      sortBy = "-submittedAt",
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (region) query.region = region;
    if (specialty) query.specialty = new RegExp(specialty, "i");
    if (currentlyInArmenia)
      query.currentlyInArmenia = currentlyInArmenia;

    const workers = await Worker.find(query)
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("-__v");

    const count = await Worker.countDocuments(query);

    res.json({
      workers,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    });
  } catch (error) {
    console.error("Error fetching workers:", error);
    res.status(500).json({
      message: "خطا در دریافت لیست کارگران",
      error: error.message,
    });
  }
});

// Get Worker by ID
app.get("/api/workers/:id", async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id).select(
      "-__v",
    );

    if (!worker) {
      return res.status(404).json({
        message: "کارگر مورد نظر یافت نشد",
      });
    }

    res.json(worker);
  } catch (error) {
    console.error("Error fetching worker:", error);
    res.status(500).json({
      message: "خطا در دریافت اطلاعات کارگر",
      error: error.message,
    });
  }
});

// Get Workers by Telegram ID
app.get("/api/workers/telegram/:telegramId", async (req, res) => {
  try {
    const workers = await Worker.find({
      telegramId: req.params.telegramId,
    })
      .sort("-submittedAt")
      .select("-__v");

    res.json({
      workers,
      count: workers.length,
    });
  } catch (error) {
    console.error("Error fetching workers by telegram ID:", error);
    res.status(500).json({
      message: "خطا در دریافت اطلاعات",
      error: error.message,
    });
  }
});

// Update Worker Status
app.patch("/api/workers/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "وضعیت نامعتبر است",
      });
    }

    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    ).select("-__v");

    if (!worker) {
      return res.status(404).json({
        message: "کارگر مورد نظر یافت نشد",
      });
    }

    // Send notification to user
    try {
      let message = "";
      if (status === "approved") {
        message = `✅ فرم شما تایید شد!\n\nبه زودی با شما تماس خواهیم گرفت.`;
      } else if (status === "rejected") {
        message = `❌ متاسفانه فرم شما رد شد.\n\nدر صورت نیاز می‌توانید مجدداً ثبت‌نام کنید.`;
      }

      if (message && worker.telegramId) {
        await bot.sendMessage(worker.telegramId, message);
      }
    } catch (err) {
      console.error("Error sending status notification:", err);
    }

    res.json({
      message: "وضعیت با موفقیت به‌روزرسانی شد",
      worker,
    });
  } catch (error) {
    console.error("Error updating worker status:", error);
    res.status(500).json({
      message: "خطا در به‌روزرسانی وضعیت",
      error: error.message,
    });
  }
});

// Delete Worker
app.delete("/api/workers/:id", async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);

    if (!worker) {
      return res.status(404).json({
        message: "کارگر مورد نظر یافت نشد",
      });
    }

    // Delete images from Cloudinary
    if (worker.images && worker.images.length > 0) {
      await deleteImagesFromCloudinary(worker.images);
    }

    await Worker.findByIdAndDelete(req.params.id);

    console.log(
      `🗑️ Worker deleted: ${worker.fullName} (${req.params.id})`,
    );

    res.json({
      message: "کارگر با موفقیت حذف شد",
    });
  } catch (error) {
    console.error("Error deleting worker:", error);
    res.status(500).json({
      message: "خطا در حذف کارگر",
      error: error.message,
    });
  }
});

// Get Statistics
app.get("/api/stats", async (req, res) => {
  try {
    const total = await Worker.countDocuments();
    const pending = await Worker.countDocuments({
      status: "pending",
    });
    const approved = await Worker.countDocuments({
      status: "approved",
    });
    const rejected = await Worker.countDocuments({
      status: "rejected",
    });
    const inArmenia = await Worker.countDocuments({
      currentlyInArmenia: "yes",
    });
    const outsideArmenia = await Worker.countDocuments({
      currentlyInArmenia: "no",
    });

    res.json({
      total,
      pending,
      approved,
      rejected,
      inArmenia,
      outsideArmenia,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      message: "خطا در دریافت آمار",
      error: error.message,
    });
  }
});

// ==================== ERROR HANDLERS ====================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.path,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);

  // Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "حجم فایل بیش از حد مجاز است (حداکثر 5 مگابایت)",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        message: "تعداد فایل‌ها بیش از حد مجاز است (حداکثر 6 فایل)",
      });
    }
  }

  res.status(err.statusCode || 500).json({
    message: err.message || "خطای سرور",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : undefined,
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log("🚀 Server is running");
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(
    `🤖 Telegram Bot: ${bot.isPolling() ? "Active" : "Inactive"}`,
  );
  console.log(
    `📦 MongoDB: ${mongoose.connection.readyState === 1 ? "Connected" : "Connecting..."}`,
  );
  console.log(`☁️  Cloudinary: Configured`);
  console.log("=".repeat(50));
});

// Graceful Shutdown
process.on("SIGTERM", async () => {
  console.log("👋 SIGTERM received. Shutting down gracefully...");
  await mongoose.connection.close();
  bot.stopPolling();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("👋 SIGINT received. Shutting down gracefully...");
  await mongoose.connection.close();
  bot.stopPolling();
  process.exit(0);
});
