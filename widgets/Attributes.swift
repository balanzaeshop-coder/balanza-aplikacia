import ActivityKit
import Foundation

struct BalanzaActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var speed: Double
        var steps: Int
        var km: Double
        var seconds: Int
    }
    var sessionId: String
}
