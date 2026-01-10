/**
 * Stream route - GET /api/stream/:id
 * Media streaming endpoint (redirect or relay)
 */

export default async function streamRoute(fastify) {
  fastify.get('/stream/:id', async (request, reply) => {
    const { id } = request.params;
    const { format = 0 } = request.query;

    // TODO: Implement stream delivery
    // For now, return placeholder
    return reply.code(501).send({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Stream endpoint not yet implemented'
      }
    });
  });
}
