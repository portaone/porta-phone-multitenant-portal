import {useEffect, useMemo} from "react"
import {useQuery} from "@tanstack/react-query"
import api from "@/lib/axios"
import {useAuthStore} from "@/lib/authStore"
import {useTenantStore} from "@/lib/tenantStore"
import {config} from "@/config/runtime"
import type {User} from "@/types"

declare global {
    interface Window {
        WebTritWidget?: {
            authenticate: (params: {configToken: string; tenantId?: string | null}) => void
        }
    }
}

const WIDGET_SCRIPT_ID = "webtrit-dialer-widget-script"
const HANDOFF_POLL_MS = 200
const HANDOFF_TIMEOUT_MS = 10000

const DialerWidget = () => {
    const {tenantId, isAdmin, isSuperTenant} = useAuthStore()
    const {currentTenant} = useTenantStore()
    const dialerUrl = config.WEBTRIT_DIALER_URL

    const active = !!tenantId && !isAdmin && !isSuperTenant

    const {data: usersData} = useQuery({
        queryKey: ["users", tenantId],
        queryFn: async () => {
            if (!tenantId) throw new Error("No tenant ID found")
            const {data} = await api.get(`/tenants/${tenantId}/users/`)
            return data as {items: User[]; count: number}
        },
        enabled: active,
        staleTime: 5 * 60 * 1000,
    })

    const configToken = useMemo(() => {
        const users = usersData?.items ?? []
        if (users.length === 0) return null
        const ownerEmail = currentTenant?.email?.toLowerCase()
        const owner = ownerEmail
            ? users.find((user) => user.email?.toLowerCase() === ownerEmail)
            : undefined
        return owner?.config_token || null
    }, [active, usersData, currentTenant?.email])

    useEffect(() => {
        if (!active || !dialerUrl || document.getElementById(WIDGET_SCRIPT_ID)) return
        const src = `${dialerUrl.replace(/\/$/, "")}/widget.js`
        const script = document.createElement("script")
        script.id = WIDGET_SCRIPT_ID
        script.src = src
        script.async = true
        document.body.appendChild(script)
    }, [active, dialerUrl])

    useEffect(() => {
        if (!configToken) return

        let cancelled = false
        const handoff = () => {
            if (cancelled) return false
            if (window.WebTritWidget?.authenticate) {
                window.WebTritWidget.authenticate({configToken, tenantId})
                return true
            }
            return false
        }

        if (handoff()) return

        const interval = window.setInterval(() => {
            if (handoff()) window.clearInterval(interval)
        }, HANDOFF_POLL_MS)
        const timeout = window.setTimeout(() => window.clearInterval(interval), HANDOFF_TIMEOUT_MS)

        return () => {
            cancelled = true
            window.clearInterval(interval)
            window.clearTimeout(timeout)
        }
    }, [configToken, tenantId])

    return null
}

export default DialerWidget
