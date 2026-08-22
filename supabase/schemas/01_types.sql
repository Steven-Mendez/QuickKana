-- Enum types shared across tables. New values must be appended (never
-- reordered): pg enums are stored by oid order.

create type public.modality as enum ('reading', 'writing');

create type public.syllabary as enum ('hiragana', 'katakana');

create type public.group_status as enum ('active', 'graduated');
