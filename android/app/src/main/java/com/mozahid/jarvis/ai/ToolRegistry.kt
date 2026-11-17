package com.mozahid.jarvis.ai

data class ToolExecutionResult(
    val toolName: String,
    val succeeded: Boolean,
    val message: String,
    val requiresConfirmation: Boolean = false
)

interface JarvisTool {
    val name: String
    val description: String
    suspend fun execute(args: Map<String, String>): ToolExecutionResult
}

class ToolRegistry {
    private val tools = linkedMapOf<String, JarvisTool>()

    fun register(tool: JarvisTool) {
        tools[tool.name] = tool
    }

    fun get(name: String): JarvisTool? = tools[name]

    fun listRegisteredNames(): List<String> = tools.keys.toList()

    suspend fun invoke(name: String, args: Map<String, String>): ToolExecutionResult {
        val tool = tools[name]
            ?: return ToolExecutionResult(
                toolName = name,
                succeeded = false,
                message = "Tool '$name' is not registered on this device."
            )
        return try {
            tool.execute(args)
        } catch (e: SecurityException) {
            ToolExecutionResult(
                toolName = name,
                succeeded = false,
                message = "Permission required for '$name': ${e.localizedMessage}"
            )
        } catch (e: Exception) {
            ToolExecutionResult(
                toolName = name,
                succeeded = false,
                message = "Tool '$name' failed: ${e.localizedMessage ?: "Unknown error"}"
            )
        }
    }
}
