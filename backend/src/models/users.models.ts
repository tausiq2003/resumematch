import {
    pgTable,
    text,
    timestamp,
    serial,
    jsonb,
    boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").unique().notNull(),
    email: text("email").unique().notNull(),
    username: text("username").unique().notNull(),
    resumeLink: text("resume_link"),
    position: text("position"),
    experience_level: text("experience_level"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const resumeAnalysis = pgTable("resume_analysis", {
    id: serial("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .unique()
        .references(() => users.clerkId),
    resumeLink: text("resume_link").notNull(),
    analysisData: jsonb("analysis_data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const jobSearchResults = pgTable("job_search_results", {
    id: serial("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .unique()
        .references(() => users.clerkId),
    searchData: jsonb("search_data").notNull(),
    isLocked: boolean("is_locked").notNull().default(false),
    lockedUntil: timestamp("locked_until"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertResumeAnalysis = typeof resumeAnalysis.$inferInsert;
export type SelectResumeAnalysis = typeof resumeAnalysis.$inferSelect;
export type InsertJobSearchResults = typeof jobSearchResults.$inferInsert;
export type SelectJobSearchResults = typeof jobSearchResults.$inferSelect;
