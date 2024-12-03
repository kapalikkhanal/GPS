-- Enable the necessary extensions
create extension if not exists "uuid-ossp";

-- Create vehicles table
create table vehicles (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    name text not null,
    device_id text not null unique,
    last_location point,
    last_updated timestamp with time zone,
    status text default 'offline',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Create vehicle_locations table for historical tracking
create table vehicle_locations (
    id uuid default uuid_generate_v4() primary key,
    vehicle_id uuid references vehicles not null,
    location point not null,
    speed float,
    heading float,
    timestamp timestamp with time zone default now()
);

-- Create notification_settings table
create table notification_settings (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    geofence_alerts boolean default true,
    offline_alerts boolean default true,
    speed_alerts boolean default true,
    speed_threshold float default 80.0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Create geofences table
create table geofences (
    id uuid default uuid_generate_v4() primary key,
    vehicle_id uuid references vehicles not null,
    name text not null,
    coordinates polygon not null,
    created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table vehicles enable row level security;
alter table vehicle_locations enable row level security;
alter table notification_settings enable row level security;
alter table geofences enable row level security;

-- Create policies for vehicles table
create policy "Users can view their own vehicles"
    on vehicles for select
    using (auth.uid() = user_id);

create policy "Users can insert their own vehicles"
    on vehicles for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own vehicles"
    on vehicles for update
    using (auth.uid() = user_id);

create policy "Users can delete their own vehicles"
    on vehicles for delete
    using (auth.uid() = user_id);

-- Create policies for vehicle_locations table
create policy "Users can view locations of their vehicles"
    on vehicle_locations for select
    using (
        exists (
            select 1 from vehicles
            where vehicles.id = vehicle_locations.vehicle_id
            and vehicles.user_id = auth.uid()
        )
    );

-- Create policies for notification_settings table
create policy "Users can view their notification settings"
    on notification_settings for select
    using (auth.uid() = user_id);

create policy "Users can insert their notification settings"
    on notification_settings for insert
    with check (auth.uid() = user_id);

create policy "Users can update their notification settings"
    on notification_settings for update
    using (auth.uid() = user_id);

-- Create policies for geofences table
create policy "Users can manage their vehicle geofences"
    on geofences for all
    using (
        exists (
            select 1 from vehicles
            where vehicles.id = geofences.vehicle_id
            and vehicles.user_id = auth.uid()
        )
    );

-- Create function to update vehicle location
create or replace function update_vehicle_location(
    p_device_id text,
    p_latitude double precision,
    p_longitude double precision,
    p_speed float default null,
    p_heading float default null
)
returns void as $$
declare
    v_vehicle_id uuid;
begin
    -- Get vehicle id from device_id
    select id into v_vehicle_id from vehicles
    where device_id = p_device_id;

    -- Update vehicle's last location
    update vehicles
    set 
        last_location = point(p_longitude, p_latitude),
        last_updated = now(),
        status = 'online'
    where id = v_vehicle_id;

    -- Insert location history
    insert into vehicle_locations (vehicle_id, location, speed, heading)
    values (v_vehicle_id, point(p_longitude, p_latitude), p_speed, p_heading);
end;
$$ language plpgsql security definer;