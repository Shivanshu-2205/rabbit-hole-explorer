import { z } from 'zod';

const pathNodeSchema = z.object({
  id:       z.string(),
  name:     z.string(),
  category: z.string().optional(),
  color:    z.string().optional(),
  icon:     z.string().optional(),
});

export const saveHistorySchema = z.object({
  searchTerm: z
    .string({ required_error: 'searchTerm is required' })
    .min(1)
    .trim(),
  path: z.array(pathNodeSchema).default([]),
});

export const mergeHistorySchema = z.object({
  guestHistory: z.array(
    z.object({
      searchTerm: z.string(),
      path:       z.array(pathNodeSchema).default([]),
      createdAt:  z.string().optional(),
    })
  ).max(10), // never merge more than the limit
});

export const saveFavouriteSchema = z.object({
  title: z
    .string({ required_error: 'title is required' })
    .min(1)
    .trim(),
  path: z.array(pathNodeSchema).default([]),
});

export const renameFavouriteSchema = z.object({
  customName: z
    .string({ required_error: 'customName is required' })
    .min(1)
    .trim(),
});