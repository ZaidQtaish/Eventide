--
-- PostgreSQL database dump
--

\restrict Egrktg0flaBFrmb9lO3LZ1za5EhKVPUaQpCmpxjWPhiqMXHqmRh1gxx4yujMDqg

-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: update_stock_snapshot(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_stock_snapshot() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO stock_snapshots (item_id, current_quantity, last_updated)
    VALUES (NEW.item_id, NEW.quantity_change, CURRENT_TIMESTAMP)
    ON CONFLICT (item_id) DO UPDATE
    SET current_quantity = stock_snapshots.current_quantity + EXCLUDED.current_quantity,
        last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_stock_snapshot() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: inventory_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_events (
    event_id integer NOT NULL,
    item_id integer,
    user_id integer,
    event_type character varying(20) NOT NULL,
    reason_code character varying(50),
    quantity_change integer NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_events OWNER TO postgres;

--
-- Name: inventory_events_event_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_events_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_events_event_id_seq OWNER TO postgres;

--
-- Name: inventory_events_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_events_event_id_seq OWNED BY public.inventory_events.event_id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    item_id integer NOT NULL,
    sku character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    category character varying(50),
    min_stock_level integer DEFAULT 10
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: items_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.items_item_id_seq OWNER TO postgres;

--
-- Name: items_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_item_id_seq OWNED BY public.items.item_id;


--
-- Name: stock_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_snapshots (
    item_id integer NOT NULL,
    current_quantity integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.stock_snapshots OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    username character varying(50) NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    phone_number character varying(20),
    password_hash text NOT NULL,
    role character varying(20) DEFAULT 'staff'::character varying
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_user_id_seq OWNER TO postgres;

--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: inventory_events event_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_events ALTER COLUMN event_id SET DEFAULT nextval('public.inventory_events_event_id_seq'::regclass);


--
-- Name: items item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN item_id SET DEFAULT nextval('public.items_item_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Data for Name: inventory_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_events (event_id, item_id, user_id, event_type, reason_code, quantity_change, "timestamp") FROM stdin;
1	1	1	STOCK_IN	Init	10	2026-03-10 12:48:19.366712
2	1	1	STOCK_OUT	sold	-5	2026-03-10 12:52:19.81034
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (item_id, sku, name, description, category, min_stock_level) FROM stdin;
1	LAP-001	HP Victus	\N	Laptops	10
\.


--
-- Data for Name: stock_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_snapshots (item_id, current_quantity, last_updated) FROM stdin;
1	5	2026-03-10 12:52:19.81034
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, username, first_name, last_name, phone_number, password_hash, role) FROM stdin;
1	zaid_dev	Zaid	Admin	\N	cd6e5f8cae72a13cb149fa907abeeb19	staff
\.


--
-- Name: inventory_events_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_events_event_id_seq', 2, true);


--
-- Name: items_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_item_id_seq', 1, true);


--
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 1, true);


--
-- Name: inventory_events inventory_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_pkey PRIMARY KEY (event_id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (item_id);


--
-- Name: items items_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_sku_key UNIQUE (sku);


--
-- Name: stock_snapshots stock_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_snapshots
    ADD CONSTRAINT stock_snapshots_pkey PRIMARY KEY (item_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: inventory_events trg_after_inventory_event; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_after_inventory_event AFTER INSERT ON public.inventory_events FOR EACH ROW EXECUTE FUNCTION public.update_stock_snapshot();


--
-- Name: inventory_events inventory_events_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id);


--
-- Name: inventory_events inventory_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_events
    ADD CONSTRAINT inventory_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: stock_snapshots stock_snapshots_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_snapshots
    ADD CONSTRAINT stock_snapshots_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id);


--
-- PostgreSQL database dump complete
--

\unrestrict Egrktg0flaBFrmb9lO3LZ1za5EhKVPUaQpCmpxjWPhiqMXHqmRh1gxx4yujMDqg

