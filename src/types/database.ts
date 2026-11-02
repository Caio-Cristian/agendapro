export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Profile = {
  id: string
  full_name: string
  phone: string | null
  role: 'admin' | 'professional' | 'client'
  business_id: string | null
  created_at: string
}

export type Business = {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
  timezone: string
  cancellation_hours: number
  created_at: string
}

export type Service = {
  id: string
  business_id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  active: boolean
  created_at: string
}

export type Professional = {
  id: string
  business_id: string
  profile_id: string
  active: boolean
}

export type WorkingHours = {
  id: string
  professional_id: string
  weekday: number
  open_time: string
  close_time: string
  break_start: string | null
  break_end: string | null
}

export type BlockedTime = {
  id: string
  professional_id: string
  starts_at: string
  ends_at: string
  reason: string | null
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'canceled'

export type Appointment = {
  id: string
  business_id: string
  customer_id: string
  professional_id: string
  service_id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  notes: string | null
  created_at: string
}

export type Notification = {
  id: string
  recipient_id: string
  appointment_id: string | null
  title: string
  body: string
  read_at: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        Pick<Profile, 'id' | 'full_name'> & Partial<Pick<Profile, 'phone' | 'role' | 'business_id'>>
      >
      businesses: Table<
        Business,
        Pick<Business, 'name' | 'slug'> &
          Partial<Omit<Business, 'id' | 'name' | 'slug' | 'created_at'>>
      >
      services: Table<
        Service,
        Pick<Service, 'business_id' | 'name' | 'duration_minutes' | 'price_cents'> &
          Partial<Pick<Service, 'description' | 'active'>>
      >
      professionals: Table<
        Professional,
        Pick<Professional, 'business_id' | 'profile_id'> & Partial<Pick<Professional, 'active'>>
      >
      working_hours: Table<
        WorkingHours,
        Pick<WorkingHours, 'professional_id' | 'weekday' | 'open_time' | 'close_time'> &
          Partial<Pick<WorkingHours, 'break_start' | 'break_end'>>
      >
      blocked_times: Table<
        BlockedTime,
        Pick<BlockedTime, 'professional_id' | 'starts_at' | 'ends_at'> &
          Partial<Pick<BlockedTime, 'reason'>>
      >
      appointments: Table<
        Appointment,
        Pick<
          Appointment,
          'business_id' | 'customer_id' | 'professional_id' | 'service_id' | 'starts_at' | 'ends_at'
        > &
          Partial<Pick<Appointment, 'status' | 'notes'>>
      >
      notifications: Table<
        Notification,
        Pick<Notification, 'recipient_id' | 'title' | 'body'> &
          Partial<Pick<Notification, 'appointment_id' | 'read_at'>>
      >
    }
    Views: {
      professional_directory: {
        Row: { profile_id: string; full_name: string; business_id: string }
        Relationships: []
      }
    }
    Functions: {
      create_business: { Args: { p_name: string; p_slug: string }; Returns: string }
      save_weekly_availability: {
        Args: {
          p_professional_id: string
          p_hours: Array<{
            weekday: number
            open_time: string
            close_time: string
            break_start: string | null
            break_end: string | null
          }>
        }
        Returns: undefined
      }
      get_available_slots: {
        Args: { p_professional_id: string; p_service_id: string; p_date: string }
        Returns: { slot_start: string }[]
      }
      book_appointment: {
        Args: {
          p_professional_id: string
          p_service_id: string
          p_start_at: string
          p_notes?: string | null
        }
        Returns: string
      }
      change_appointment_status: {
        Args: { p_appointment_id: string; p_status: AppointmentStatus }
        Returns: undefined
      }
      cancel_appointment: { Args: { p_appointment_id: string }; Returns: undefined }
      reschedule_appointment: {
        Args: { p_appointment_id: string; p_new_start_at: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
