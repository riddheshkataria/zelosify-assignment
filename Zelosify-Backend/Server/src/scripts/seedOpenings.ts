import prisma from "../config/prisma/prisma.js";

/**
 * Seeds the database with the "Bruce Wayne Corp" tenant, a test Hiring Manager,
 * and at least 12 diverse contract openings across roles, experience ranges, and contract types.
 */
async function seedOpenings() {
  try {
    console.log("🌱 Starting seed for Vendor–Hiring Manager Contract Management...");

    // 1. Ensure Tenant "Bruce Wayne Corp" exists
    let tenant = await prisma.tenants.findFirst({
      where: { companyName: "Bruce Wayne Corp" },
    });

    if (!tenant) {
      tenant = await prisma.tenants.create({
        data: {
          companyName: "Bruce Wayne Corp",
        },
      });
      console.log(`✅ Created Tenant: "${tenant.companyName}" (${tenant.tenantId})`);
    } else {
      console.log(`ℹ️ Tenant already exists: "${tenant.companyName}" (${tenant.tenantId})`);
    }

    const tenantId = tenant.tenantId;

    // 2. Ensure a default Hiring Manager exists under this tenant
    let hiringManager = await prisma.user.findFirst({
      where: { email: "lucius.fox@waynetech.com", tenantId },
    });

    if (!hiringManager) {
      hiringManager = await prisma.user.create({
        data: {
          username: "lucius_fox",
          email: "lucius.fox@waynetech.com",
          firstName: "Lucius",
          lastName: "Fox",
          department: "Applied Sciences & Engineering",
          role: "HIRING_MANAGER",
          tenantId,
          profileComplete: true,
          provider: "KEYCLOAK",
        },
      });
      console.log(`✅ Created Hiring Manager: ${hiringManager.firstName} ${hiringManager.lastName} (${hiringManager.id})`);
    } else {
      console.log(`ℹ️ Hiring Manager already exists: ${hiringManager.firstName} ${hiringManager.lastName} (${hiringManager.id})`);
    }

    const hiringManagerId = hiringManager.id;

    // 3. Define 14 diverse contract openings
    const sampleOpenings = [
      {
        title: "Senior Full Stack Engineer",
        description: "Develop enterprise-grade multi-tenant web applications with React, Next.js, and Node.js microservices.",
        location: "Remote",
        contractType: "C2C",
        experienceMin: 5,
        experienceMax: 8,
        status: "OPEN" as const,
      },
      {
        title: "Cloud Infrastructure Architect",
        description: "Architect secure multi-region AWS cloud foundations with Terraform, EKS, and Zero-Trust network topologies.",
        location: "Gotham City, NY",
        contractType: "W2 Contract",
        experienceMin: 8,
        experienceMax: 12,
        status: "OPEN" as const,
      },
      {
        title: "Lead DevOps & Platform Engineer",
        description: "Scale automated CI/CD pipelines, container orchestration with Kubernetes, and robust GitOps workflows.",
        location: "Remote",
        contractType: "C2C",
        experienceMin: 6,
        experienceMax: 10,
        status: "OPEN" as const,
      },
      {
        title: "Principal AI/ML Engineer",
        description: "Design agentic LLM workflows, tool-calling frameworks, evaluation pipelines, and vector retrieval architectures.",
        location: "San Francisco, CA",
        contractType: "C2C",
        experienceMin: 7,
        experienceMax: 12,
        status: "OPEN" as const,
      },
      {
        title: "Senior Cybersecurity Analyst",
        description: "Lead threat hunting, vulnerability assessments, automated SOC compliance, and incident response operations.",
        location: "Gotham City, NY",
        contractType: "1099",
        experienceMin: 4,
        experienceMax: 8,
        status: "OPEN" as const,
      },
      {
        title: "Frontend Lead Engineer",
        description: "Deliver high-performance client applications with Next.js 15, Redux Toolkit, Tailwind CSS, and Web Vitals optimization.",
        location: "Remote",
        contractType: "Full-Time Contract",
        experienceMin: 5,
        experienceMax: 9,
        status: "OPEN" as const,
      },
      {
        title: "Backend Distributed Systems Engineer",
        description: "Build ultra-low latency transaction systems with Go, PostgreSQL, Redis, and event-driven Apache Kafka brokers.",
        location: "New York, NY",
        contractType: "W2 Contract",
        experienceMin: 6,
        experienceMax: 10,
        status: "OPEN" as const,
      },
      {
        title: "QA Automation Architect",
        description: "Build robust end-to-end testing frameworks across web and mobile using Playwright, Vitest, and contract testing.",
        location: "Remote",
        contractType: "C2C",
        experienceMin: 4,
        experienceMax: 7,
        status: "OPEN" as const,
      },
      {
        title: "Data Platform Engineer",
        description: "Implement high-throughput real-time analytics streaming pipelines using Apache Spark, Snowflake, and dbt.",
        location: "Chicago, IL",
        contractType: "W2 Contract",
        experienceMin: 5,
        experienceMax: 8,
        status: "OPEN" as const,
      },
      {
        title: "Mobile Application Developer",
        description: "Develop cross-platform native-feeling mobile applications with React Native, TypeScript, and offline-first persistence.",
        location: "Remote",
        contractType: "1099",
        experienceMin: 3,
        experienceMax: 6,
        status: "OPEN" as const,
      },
      {
        title: "Site Reliability Engineer (SRE)",
        description: "Maintain 99.99% uptime, design incident recovery runbooks, SLI/SLO dashboards, and proactive Datadog monitors.",
        location: "Gotham City, NY",
        contractType: "Full-Time Contract",
        experienceMin: 5,
        experienceMax: 9,
        status: "OPEN" as const,
      },
      {
        title: "Database Administrator & Performance Tuning Specialist",
        description: "Optimize high-volume PostgreSQL query plans, partition strategies, connection pooling, and continuous backups.",
        location: "Austin, TX",
        contractType: "C2C",
        experienceMin: 7,
        experienceMax: 11,
        status: "OPEN" as const,
      },
      {
        title: "Senior Product Designer",
        description: "Craft cohesive design systems, user flows, and wireframes in Figma with a focus on enterprise SaaS usability.",
        location: "Remote",
        contractType: "Part-Time Contract",
        experienceMin: 4,
        experienceMax: 8,
        status: "ON_HOLD" as const,
      },
      {
        title: "Embedded Systems Firmware Specialist",
        description: "Develop low-power telemetry sensors and micro-controller software in C++ and Rust for secure edge communications.",
        location: "Gotham City, NY",
        contractType: "Full-Time Contract",
        experienceMin: 6,
        experienceMax: 10,
        status: "OPEN" as const,
      },
    ];

    // 4. Upsert openings
    let createdCount = 0;
    for (const item of sampleOpenings) {
      const existing = await prisma.opening.findFirst({
        where: {
          tenantId,
          title: item.title,
        },
      });

      if (!existing) {
        await prisma.opening.create({
          data: {
            tenantId,
            hiringManagerId,
            title: item.title,
            description: item.description,
            location: item.location,
            contractType: item.contractType,
            experienceMin: item.experienceMin,
            experienceMax: item.experienceMax,
            status: item.status,
            postedDate: new Date(),
          },
        });
        createdCount++;
      }
    }

    const totalOpenings = await prisma.opening.count({ where: { tenantId } });
    console.log(`🎉 Seeding complete! Created ${createdCount} new openings. Total for ${tenant.companyName}: ${totalOpenings} openings.`);
  } catch (error) {
    console.error("❌ Error seeding openings:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedOpenings();
