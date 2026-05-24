import { prisma } from "../db/prisma";
import { randomUUID } from "node:crypto";
import type { Project } from "../domain/types";

function mapProject(r: { id: string; userId: string; name: string }): Project {
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
  };
}

export async function listProjects(userId: string): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
  return rows.map(mapProject);
}

export async function createProject(userId: string, name: string): Promise<Project> {
  const id = randomUUID();
  await prisma.project.create({
    data: { id, name, user: { connect: { id: userId } } },
  });
  const row = await prisma.project.findUniqueOrThrow({ where: { id } });
  return mapProject(row);
}

export async function getProjectForUser(userId: string, projectId: string): Promise<Project | null> {
  const row = await prisma.project.findFirst({ where: { id: projectId, userId } });
  return row ? mapProject(row) : null;
}
