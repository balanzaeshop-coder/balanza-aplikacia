import AppIntents
import Foundation

private let appGroup = "group.sk.balanza.walkingpad"

@available(iOS 17.0, *)
struct SpeedUpIntent: AppIntent {
    static let title: LocalizedStringResource = "Zvýšiť rýchlosť"
    static let isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        let def = UserDefaults(suiteName: appGroup)
        let cur = def?.double(forKey: "pending_speed_delta") ?? 0
        def?.set(cur + 0.1, forKey: "pending_speed_delta")
        return .result()
    }
}

@available(iOS 17.0, *)
struct SpeedDownIntent: AppIntent {
    static let title: LocalizedStringResource = "Znížiť rýchlosť"
    static let isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        let def = UserDefaults(suiteName: appGroup)
        let cur = def?.double(forKey: "pending_speed_delta") ?? 0
        def?.set(cur - 0.1, forKey: "pending_speed_delta")
        return .result()
    }
}

@available(iOS 17.0, *)
struct StopBeltIntent: AppIntent {
    static let title: LocalizedStringResource = "Zastaviť pás"
    static let isDiscoverable: Bool = false

    func perform() async throws -> some IntentResult {
        let def = UserDefaults(suiteName: appGroup)
        def?.set(true, forKey: "pending_stop")
        return .result()
    }
}
